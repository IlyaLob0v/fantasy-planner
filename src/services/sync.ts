import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SyncKeep, SyncReport, SyncStatus } from "@/domain/types";
import { describeError, ipc, isErrorKind } from "@/ipc";

/** Сверка после последней правки: одна отправка на серию действий, а не на каждое. */
const AFTER_CHANGE_MS = 3000;
/** Пока окно открыто, чужие дела подтягиваются и без своих правок. */
const PERIOD_MS = 60_000;

const statusKey = ["sync-status"] as const;

export interface SignInForm {
  server: string;
  email: string;
  password: string;
  deviceName: string;
  create: boolean;
}

export interface GuildSync {
  status: SyncStatus | null;
  busy: boolean;
  /** Последняя неудача: тихая строка в уставе, без всплывающих окон. */
  error: string | null;
  signIn: (form: SignInForm) => Promise<void>;
  link: (keep: SyncKeep) => Promise<void>;
  syncNow: () => void;
  signOut: () => Promise<void>;
  /** Смена пароля; ошибка возвращается вызывающему, чтобы форма показала её у себя. */
  changePassword: (password: string, newPassword: string) => Promise<void>;
}

/**
 * Гильдейская почта (specs/sync.md, раздел 4): сверка при запуске, при возврате к окну, через 3 секунды
 * после правки и кнопкой. Если сверка что-то принесла, `onApplied` пересчитывает героя из журнала.
 */
export function useGuildSync(onApplied: () => Promise<void>): GuildSync {
  const client = useQueryClient();
  const status = useQuery({ queryKey: statusKey, queryFn: ipc.syncStatus });
  const linked = status.data?.linked ?? false;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);
  const applied = useRef(onApplied);
  useEffect(() => {
    applied.current = onApplied;
  }, [onApplied]);

  const refreshStatus = useCallback(() => client.invalidateQueries({ queryKey: statusKey }), [client]);

  /** Одна сверка за раз; ошибка не мешает игре и не всплывает, а ждёт в уставе. */
  const guarded = useCallback(
    async (work: () => Promise<SyncReport>) => {
      if (running.current) return;
      running.current = true;
      setBusy(true);
      try {
        const report = await work();
        setError(null);
        if (report.applied > 0 || report.reset) {
          await applied.current();
        }
      } catch (e) {
        setError(isErrorKind(e, "signed_out") ? "Почта просит войти заново" : describeError(e));
        throw e;
      } finally {
        running.current = false;
        setBusy(false);
        await refreshStatus();
      }
    },
    [refreshStatus],
  );

  const syncNow = useCallback(() => {
    guarded(() => ipc.syncNow()).catch(() => undefined);
  }, [guarded]);

  useEffect(() => {
    if (!linked) return;
    let timer = window.setTimeout(syncNow, 0);
    const soon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(syncNow, AFTER_CHANGE_MS);
    };
    // Каждая запись в игре заканчивается обновлением данных: по нему и видно, что была правка.
    const cache = client.getQueryCache();
    const unsubscribe = cache.subscribe((event) => {
      const own = event.query === cache.find({ queryKey: statusKey });
      if (event.type === "updated" && event.action.type === "invalidate" && !own && !running.current) {
        soon();
      }
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") syncNow();
    };
    document.addEventListener("visibilitychange", onVisible);
    const period = window.setInterval(() => {
      if (document.visibilityState === "visible") syncNow();
    }, PERIOD_MS);
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      window.clearInterval(period);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [linked, client, syncNow]);

  const link = useCallback((keep: SyncKeep) => guarded(() => ipc.syncLink(keep)), [guarded]);

  /** Без спора выбор делается сам: пустой аккаунт получает героя устройства, пустое устройство — героя аккаунта. */
  const signIn = useCallback(
    async (form: SignInForm) => {
      const result = await ipc.syncSignIn(form).catch((e: unknown) => {
        setError(describeError(e));
        throw e;
      });
      setError(null);
      await refreshStatus();
      const choice: SyncKeep | null = result.remoteRecords === 0 ? "local" : result.localProgress ? null : "remote";
      if (choice) await link(choice);
    },
    [link, refreshStatus],
  );

  const signOut = useCallback(async () => {
    await ipc.syncSignOut();
    setError(null);
    await refreshStatus();
  }, [refreshStatus]);

  const changePassword = useCallback(
    async (password: string, newPassword: string) => {
      try {
        await ipc.syncChangePassword(password, newPassword);
      } finally {
        await refreshStatus();
      }
    },
    [refreshStatus],
  );

  const data = status.data ?? null;
  return useMemo(
    () => ({ status: data, busy, error, signIn, link, syncNow, signOut, changePassword }),
    [data, busy, error, signIn, link, syncNow, signOut, changePassword],
  );
}

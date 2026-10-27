import { useCallback, useEffect } from "react";

import { isMobile } from "@/app/platform";
import { reminderPlan } from "@/domain/reminder";
import type { Settings } from "@/domain/types";
import { notify } from "@/ipc/notify";

import { useGame } from "./game";

/**
 * Мягкое напоминание. На телефоне ставится на неделю вперёд и переставляется при каждом изменении дня,
 * так что сделанное дело снимает сегодняшнее. На ПК срабатывает таймером, пока приложение открыто или свёрнуто.
 */
export function useReminder() {
  const { settings, today, days, reportError } = useGame();
  useEffect(() => {
    const current = reminderPlan(new Date(), today, settings, days);
    if (isMobile) {
      notify.replaceScheduled(current).catch(reportError);
      return;
    }
    const first = current[0];
    if (!first || first.gameDate !== today) return;
    const id = window.setTimeout(() => {
      notify.show(first.body);
    }, first.at.getTime() - Date.now());
    return () => {
      window.clearTimeout(id);
    };
  }, [today, settings, days, reportError]);
}

/** Сохраняет напоминание; включение сначала спрашивает разрешение у системы. */
export function useSaveReminder(): (next: Settings["reminder"]) => void {
  const { settings, setSetting, reportError } = useGame();
  return useCallback(
    (next: Settings["reminder"]) => {
      const save = () => {
        setSetting("reminder", { enabled: next.enabled, hour: next.hour, quiet_weekdays: next.quietWeekdays });
      };
      if (!next.enabled || settings.reminder.enabled) {
        save();
        return;
      }
      notify
        .ensurePermission()
        .then((granted) => {
          if (granted) save();
          else reportError(new Error("Система не разрешила уведомления. Их можно включить в настройках устройства, а потом здесь."));
        })
        .catch(reportError);
    },
    [settings.reminder.enabled, setSetting, reportError],
  );
}

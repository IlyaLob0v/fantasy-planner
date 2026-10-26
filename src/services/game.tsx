import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { GOLD_ANCHOR_ID } from "@/app/anchors";

import { parseSettings } from "@/domain/settings";
import { addDays } from "@/domain/time";
import { planCompleteQuest, planDayClose, planRestAction, planUndoQuest, type DeedResult, type TurnContext } from "@/domain/turns";
import type { Character, Day, GameDate, Quest, QuestFields, RestAction, Settings } from "@/domain/types";
import { describeError, ipc } from "@/ipc";

import { useGameDate } from "./clock";

const DAYS_WINDOW = 400;

const keys = {
  character: ["character"] as const,
  settings: ["settings"] as const,
  quests: ["quests"] as const,
  days: ["days"] as const,
  restActions: ["rest-actions"] as const,
};

export interface RewardEvent extends DeedResult {
  id: number;
  /** Откуда летят монеты и куда (счётчик золота); измеряется в момент клика. */
  origin: DOMRect | null;
  target: DOMRect | null;
  questId: number | null;
}

export interface GameState {
  character: Character;
  settings: Settings;
  quests: Quest[];
  days: Day[];
  restActions: RestAction[];
  today: GameDate;
  lastReward: RewardEvent | null;
  error: string | null;
  clearError: () => void;
  completeQuest: (quest: Quest, origin: DOMRect | null) => void;
  undoQuest: (quest: Quest) => void;
  takeRest: (action: RestAction, origin: DOMRect | null) => void;
  createQuest: (fields: QuestFields) => Promise<Quest>;
  updateQuest: (id: number, fields: QuestFields) => void;
  archiveQuest: (id: number) => void;
  renameCharacter: (name: string) => void;
}

const GameContext = createContext<GameState | null>(null);

export function useGame(): GameState {
  const game = use(GameContext);
  if (!game) {
    throw new Error("useGame вызван вне GameProvider");
  }
  return game;
}

type Boot = { status: "loading" } | { status: "failed"; message: string } | { status: "ready"; game: GameState };

/** Загружает мир, подводит итоги прошедших суток и раздаёт состояние и действия экранам. */
export function useGameBoot(): Boot {
  const client = useQueryClient();
  const settingsQuery = useQuery({ queryKey: keys.settings, queryFn: async () => parseSettings(await ipc.getSettings()) });
  const settings = settingsQuery.data ?? null;
  const today = useGameDate(settings?.dayStartHour ?? null);

  const character = useQuery({ queryKey: keys.character, queryFn: ipc.getCharacter });
  const quests = useQuery({ queryKey: keys.quests, queryFn: ipc.listQuests });
  const days = useQuery({
    queryKey: [...keys.days, today],
    queryFn: () => ipc.listDays(addDays(today ?? "2000-01-01", -DAYS_WINDOW)),
    enabled: today !== null,
  });
  const restActions = useQuery({ queryKey: keys.restActions, queryFn: ipc.listRestActions });

  const [lastReward, setLastReward] = useState<RewardEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closedFor = useRef<GameDate | null>(null);

  const ready = settings && today && character.data && quests.data && days.data && restActions.data;

  const context = useCallback(
    (): TurnContext | null =>
      settings && today && character.data && days.data
        ? { character: character.data, settings, days: days.data, today, now: new Date() }
        : null,
    [settings, today, character.data, days.data],
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: keys.character }),
      client.invalidateQueries({ queryKey: keys.quests }),
      client.invalidateQueries({ queryKey: keys.days }),
    ]);
  }, [client]);

  const { mutate: commitOutcome } = useMutation({
    mutationFn: ipc.commitOutcome,
    onSuccess: (hero) => {
      client.setQueryData(keys.character, hero);
    },
    onSettled: refresh,
    onError: (e) => {
      setError(describeError(e));
    },
  });

  useEffect(() => {
    const ctx = context();
    if (!ctx || closedFor.current === ctx.today) {
      return;
    }
    closedFor.current = ctx.today;
    const plan = planDayClose(ctx);
    if (plan) {
      commitOutcome(plan.outcome);
    }
  }, [context, commitOutcome]);

  const fail = useCallback((e: unknown) => {
    setError(describeError(e));
  }, []);

  const announce = useCallback((result: DeedResult, origin: DOMRect | null, questId: number | null) => {
    const target = document.getElementById(GOLD_ANCHOR_ID)?.getBoundingClientRect() ?? null;
    setLastReward((prev) => ({ ...result, id: (prev?.id ?? 0) + 1, origin, target, questId }));
  }, []);

  const completeQuest = useCallback(
    (quest: Quest, origin: DOMRect | null) => {
      const ctx = context();
      if (!ctx) return;
      try {
        const result = planCompleteQuest(ctx, quest);
        commitOutcome(result.outcome, {
          onSuccess: () => {
            announce(result, origin, quest.id);
          },
        });
      } catch (e) {
        fail(e);
      }
    },
    [context, commitOutcome, announce, fail],
  );

  const takeRest = useCallback(
    (action: RestAction, origin: DOMRect | null) => {
      const ctx = context();
      if (!ctx) return;
      const result = planRestAction(ctx, action);
      commitOutcome(result.outcome, {
        onSuccess: () => {
          announce(result, origin, null);
        },
      });
    },
    [context, commitOutcome, announce],
  );

  const undoQuest = useCallback(
    (quest: Quest) => {
      const ctx = context();
      if (!ctx) return;
      ipc
        .listLedgerForDate(ctx.today)
        .then((ledger) => {
          commitOutcome(planUndoQuest(ctx, quest, ledger));
        })
        .catch(fail);
    },
    [context, commitOutcome, fail],
  );

  const createQuest = useCallback(
    async (fields: QuestFields) => {
      const created = await ipc.createQuest(fields);
      await client.invalidateQueries({ queryKey: keys.quests });
      return created;
    },
    [client],
  );

  const updateQuest = useCallback(
    (id: number, fields: QuestFields) => {
      ipc
        .updateQuest(id, fields)
        .then((saved) => {
          client.setQueryData<Quest[]>(keys.quests, (list) => list?.map((q) => (q.id === id ? saved : q)));
        })
        .catch(fail);
    },
    [client, fail],
  );

  const archiveQuest = useCallback(
    (id: number) => {
      ipc
        .archiveQuest(id)
        .then(() => client.invalidateQueries({ queryKey: keys.quests }))
        .catch(fail);
    },
    [client, fail],
  );

  const renameCharacter = useCallback(
    (name: string) => {
      ipc
        .renameCharacter(name)
        .then((hero) => {
          client.setQueryData(keys.character, hero);
        })
        .catch(fail);
    },
    [client, fail],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const game = useMemo<GameState | null>(
    () =>
      ready
        ? {
            character: character.data,
            settings,
            quests: quests.data,
            days: days.data,
            restActions: restActions.data,
            today,
            lastReward,
            error,
            clearError,
            completeQuest,
            undoQuest,
            takeRest,
            createQuest,
            updateQuest,
            archiveQuest,
            renameCharacter,
          }
        : null,
    [ready, character.data, settings, quests.data, days.data, restActions.data, today, lastReward, error, clearError, completeQuest, undoQuest, takeRest, createQuest, updateQuest, archiveQuest, renameCharacter],
  );

  const firstError = [settingsQuery, character, quests, days, restActions].find((q) => q.error)?.error;
  if (firstError) {
    return { status: "failed", message: describeError(firstError) };
  }
  return game ? { status: "ready", game } : { status: "loading" };
}

export function GameProvider({ game, children }: { game: GameState; children: ReactNode }) {
  return <GameContext value={game}>{children}</GameContext>;
}

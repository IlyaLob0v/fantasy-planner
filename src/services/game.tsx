import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { GOLD_ANCHOR_ID } from "@/app/anchors";
import { weekStart } from "@/domain/rituals";
import { mergeRates, parseSettings } from "@/domain/settings";
import { addDays } from "@/domain/time";
import {
  planBuyRest,
  planBuyReward,
  planCompleteQuest,
  planDayClose,
  planRestAction,
  planRitual,
  planUndoQuest,
  planUndoRitual,
  type DeedResult,
  type TurnContext,
} from "@/domain/turns";
import type {
  Character,
  Day,
  GameDate,
  InventoryItem,
  Outcome,
  Quest,
  QuestFields,
  RealReward,
  RealRewardFields,
  RestAction,
  Reward,
  Ritual,
  RitualCompletion,
  RitualFields,
  Settings,
} from "@/domain/types";
import { describeError, ipc } from "@/ipc";

import { useGameDate } from "./clock";

const DAYS_WINDOW = 400;

const keys = {
  character: ["character"] as const,
  settings: ["settings"] as const,
  quests: ["quests"] as const,
  days: ["days"] as const,
  restActions: ["rest-actions"] as const,
  rituals: ["rituals"] as const,
  completions: ["ritual-completions"] as const,
  rewards: ["rewards"] as const,
  inventory: ["inventory"] as const,
};

/** Событие для слоя наград: монеты летят в сундук (награда) или из него (трата). */
export interface RewardEvent {
  id: number;
  direction: "in" | "out";
  reward: Reward;
  levelUp: number | null;
  revived: boolean;
  /** Карточка, откуда (или куда) летят монеты, и счётчик золота; измеряются в момент клика. */
  origin: DOMRect | null;
  target: DOMRect | null;
  questId: number | null;
}

/** Ставки правятся отдельно через saveRates, чтобы не потерять скрытые. */
export type EditableSetting = Exclude<Parameters<typeof ipc.setSetting>[0], "rates">;

export interface GameState {
  character: Character;
  settings: Settings;
  quests: Quest[];
  days: Day[];
  restActions: RestAction[];
  rituals: Ritual[];
  completions: RitualCompletion[];
  rewards: RealReward[];
  inventory: InventoryItem[];
  today: GameDate;
  lastReward: RewardEvent | null;
  error: string | null;
  clearError: () => void;
  completeQuest: (quest: Quest, origin: DOMRect | null) => void;
  undoQuest: (quest: Quest) => void;
  toggleRitual: (ritual: Ritual, done: boolean, origin: DOMRect | null) => void;
  takeRest: (action: RestAction, origin: DOMRect | null) => void;
  buyReward: (reward: RealReward, origin: DOMRect | null) => void;
  buyRest: (date: GameDate, origin: DOMRect | null) => void;
  redeem: (item: InventoryItem) => void;
  createQuest: (fields: QuestFields) => Promise<Quest>;
  updateQuest: (id: number, fields: QuestFields) => void;
  archiveQuest: (id: number) => void;
  saveRitual: (id: number | null, fields: RitualFields) => Promise<Ritual>;
  archiveRitual: (id: number) => void;
  saveReward: (id: number | null, fields: RealRewardFields) => Promise<RealReward>;
  archiveReward: (id: number) => void;
  addRestAction: (title: string) => void;
  archiveRestAction: (id: number) => void;
  setSetting: (key: EditableSetting, value: unknown) => void;
  saveRates: (rates: Settings["rates"]) => void;
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

function goldAnchor(): DOMRect | null {
  return document.getElementById(GOLD_ANCHOR_ID)?.getBoundingClientRect() ?? null;
}

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
  const rituals = useQuery({ queryKey: keys.rituals, queryFn: ipc.listRituals });
  const completions = useQuery({
    queryKey: [...keys.completions, today],
    queryFn: () => ipc.listRitualCompletions(weekStart(today ?? "2000-01-03")),
    enabled: today !== null,
  });
  const rewards = useQuery({ queryKey: keys.rewards, queryFn: ipc.listRewards });
  const inventory = useQuery({ queryKey: keys.inventory, queryFn: ipc.listInventory });

  const [lastReward, setLastReward] = useState<RewardEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closedFor = useRef<GameDate | null>(null);

  const context = useCallback(
    (): TurnContext | null =>
      settings && today && character.data && days.data
        ? { character: character.data, settings, days: days.data, today, now: new Date() }
        : null,
    [settings, today, character.data, days.data],
  );

  const fail = useCallback((e: unknown) => {
    setError(describeError(e));
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all(
      [keys.character, keys.quests, keys.days, keys.completions, keys.inventory].map((queryKey) =>
        client.invalidateQueries({ queryKey }),
      ),
    );
  }, [client]);

  const { mutate: commitOutcome } = useMutation({
    mutationFn: ipc.commitOutcome,
    onSuccess: (hero) => {
      client.setQueryData(keys.character, hero);
    },
    onSettled: refresh,
    onError: fail,
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

  const announce = useCallback(
    (event: Omit<RewardEvent, "id" | "target">) => {
      const target = goldAnchor();
      setLastReward((prev) => ({ ...event, id: (prev?.id ?? 0) + 1, target }));
    },
    [],
  );

  /** Планирует ход по текущему контексту и записывает его; ошибка плана (нет золота и т. п.) уходит в сообщение. */
  const play = useCallback(
    (plan: (ctx: TurnContext) => Outcome, onDone?: () => void) => {
      const ctx = context();
      if (!ctx) return;
      try {
        const outcome = plan(ctx);
        commitOutcome(outcome, onDone ? { onSuccess: onDone } : undefined);
      } catch (e) {
        fail(e);
      }
    },
    [context, commitOutcome, fail],
  );

  const deed = useCallback(
    (plan: (ctx: TurnContext) => DeedResult, origin: DOMRect | null, questId: number | null) => {
      let result: DeedResult | null = null;
      play(
        (ctx) => {
          result = plan(ctx);
          return result.outcome;
        },
        () => {
          if (result) {
            announce({ direction: "in", reward: result.reward, levelUp: result.levelUp, revived: result.revived, origin, questId });
          }
        },
      );
    },
    [play, announce],
  );

  const spent = useCallback(
    (gold: number, origin: DOMRect | null) => {
      announce({ direction: "out", reward: { xp: 0, gold, attribute: null, attributeDelta: 0 }, levelUp: null, revived: false, origin, questId: null });
    },
    [announce],
  );

  const completeQuest = useCallback(
    (quest: Quest, origin: DOMRect | null) => {
      deed((ctx) => planCompleteQuest(ctx, quest), origin, quest.id);
    },
    [deed],
  );

  const takeRest = useCallback(
    (action: RestAction, origin: DOMRect | null) => {
      deed((ctx) => planRestAction(ctx, action), origin, null);
    },
    [deed],
  );

  const withTodayLedger = useCallback(
    (plan: (ctx: TurnContext, ledger: Awaited<ReturnType<typeof ipc.listLedgerForDate>>) => Outcome) => {
      const ctx = context();
      if (!ctx) return;
      ipc
        .listLedgerForDate(ctx.today)
        .then((ledger) => {
          play((fresh) => plan(fresh, ledger));
        })
        .catch(fail);
    },
    [context, play, fail],
  );

  const undoQuest = useCallback(
    (quest: Quest) => {
      withTodayLedger((ctx, ledger) => planUndoQuest(ctx, quest, ledger));
    },
    [withTodayLedger],
  );

  const toggleRitual = useCallback(
    (ritual: Ritual, done: boolean, origin: DOMRect | null) => {
      if (done) {
        withTodayLedger((ctx, ledger) => planUndoRitual(ctx, ritual, ledger));
      } else {
        deed((ctx) => planRitual(ctx, ritual), origin, null);
      }
    },
    [withTodayLedger, deed],
  );

  const buyReward = useCallback(
    (reward: RealReward, origin: DOMRect | null) => {
      play((ctx) => planBuyReward(ctx, reward), () => {
        spent(reward.price, origin);
      });
    },
    [play, spent],
  );

  const buyRest = useCallback(
    (date: GameDate, origin: DOMRect | null) => {
      play((ctx) => planBuyRest(ctx, date), () => {
        if (settings) spent(settings.restPrice, origin);
      });
    },
    [play, spent, settings],
  );

  const invalidate = useCallback(
    (queryKey: readonly string[]) => client.invalidateQueries({ queryKey }),
    [client],
  );

  const redeem = useCallback(
    (item: InventoryItem) => {
      ipc
        .redeemItem(item.id)
        .then(() => invalidate(keys.inventory))
        .catch(fail);
    },
    [invalidate, fail],
  );

  const createQuest = useCallback(
    async (fields: QuestFields) => {
      const created = await ipc.createQuest(fields);
      await invalidate(keys.quests);
      return created;
    },
    [invalidate],
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
        .then(() => invalidate(keys.quests))
        .catch(fail);
    },
    [invalidate, fail],
  );

  const saveRitual = useCallback(
    async (id: number | null, fields: RitualFields) => {
      const saved = id === null ? await ipc.createRitual(fields) : await ipc.updateRitual(id, fields);
      await invalidate(keys.rituals);
      return saved;
    },
    [invalidate],
  );

  const archiveRitual = useCallback(
    (id: number) => {
      ipc
        .archiveRitual(id)
        .then(() => invalidate(keys.rituals))
        .catch(fail);
    },
    [invalidate, fail],
  );

  const saveReward = useCallback(
    async (id: number | null, fields: RealRewardFields) => {
      const saved = id === null ? await ipc.createReward(fields) : await ipc.updateReward(id, fields);
      await invalidate(keys.rewards);
      return saved;
    },
    [invalidate],
  );

  const archiveReward = useCallback(
    (id: number) => {
      ipc
        .archiveReward(id)
        .then(() => invalidate(keys.rewards))
        .catch(fail);
    },
    [invalidate, fail],
  );

  const addRestAction = useCallback(
    (title: string) => {
      ipc
        .createRestAction(title)
        .then(() => invalidate(keys.restActions))
        .catch(fail);
    },
    [invalidate, fail],
  );

  const archiveRestAction = useCallback(
    (id: number) => {
      ipc
        .archiveRestAction(id)
        .then(() => invalidate(keys.restActions))
        .catch(fail);
    },
    [invalidate, fail],
  );

  const setSetting = useCallback(
    (key: EditableSetting, value: unknown) => {
      ipc
        .setSetting(key, value)
        .then(() => invalidate(keys.settings))
        .catch(fail);
    },
    [invalidate, fail],
  );

  const saveRates = useCallback(
    (rates: Settings["rates"]) => {
      ipc
        .getSettings()
        .then((raw) => ipc.setSetting("rates", mergeRates(raw, rates)))
        .then(() => invalidate(keys.settings))
        .catch(fail);
    },
    [invalidate, fail],
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

  const game = useMemo<GameState | null>(() => {
    if (
      !settings ||
      !today ||
      !character.data ||
      !quests.data ||
      !days.data ||
      !restActions.data ||
      !rituals.data ||
      !completions.data ||
      !rewards.data ||
      !inventory.data
    ) {
      return null;
    }
    return {
      character: character.data,
      settings,
      quests: quests.data,
      days: days.data,
      restActions: restActions.data,
      rituals: rituals.data,
      completions: completions.data,
      rewards: rewards.data,
      inventory: inventory.data,
      today,
      lastReward,
      error,
      clearError,
      completeQuest,
      undoQuest,
      toggleRitual,
      takeRest,
      buyReward,
      buyRest,
      redeem,
      createQuest,
      updateQuest,
      archiveQuest,
      saveRitual,
      archiveRitual,
      saveReward,
      archiveReward,
      addRestAction,
      archiveRestAction,
      setSetting,
      saveRates,
      renameCharacter,
    };
  }, [
    settings,
    today,
    character.data,
    quests.data,
    days.data,
    restActions.data,
    rituals.data,
    completions.data,
    rewards.data,
    inventory.data,
    lastReward,
    error,
    clearError,
    completeQuest,
    undoQuest,
    toggleRitual,
    takeRest,
    buyReward,
    buyRest,
    redeem,
    createQuest,
    updateQuest,
    archiveQuest,
    saveRitual,
    archiveRitual,
    saveReward,
    archiveReward,
    addRestAction,
    archiveRestAction,
    setSetting,
    saveRates,
    renameCharacter,
  ]);

  const firstError = [settingsQuery, character, quests, days, restActions, rituals, completions, rewards, inventory].find(
    (q) => q.error,
  )?.error;
  if (firstError) {
    return { status: "failed", message: describeError(firstError) };
  }
  return game ? { status: "ready", game } : { status: "loading" };
}

export function GameProvider({ game, children }: { game: GameState; children: ReactNode }) {
  return <GameContext value={game}>{children}</GameContext>;
}

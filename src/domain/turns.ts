import { lootFor, lootOf, stagesOf } from "./bosses";
import { applyReward, stateOf } from "./character";
import { ownsLocation } from "./locations";
import { questReward, restActionReward, ritualReward } from "./rewards";
import { closePastDays, currentStreak } from "./streak";
import type {
  Character,
  CharacterState,
  Day,
  GameDate,
  InventoryItem,
  LedgerEntry,
  Location,
  NewLedgerEntry,
  NewInventoryItem,
  Outcome,
  Quest,
  QuestStatusChange,
  RealReward,
  RestAction,
  Reward,
  Ritual,
  Settings,
} from "./types";

export interface TurnContext {
  character: Character;
  settings: Settings;
  days: readonly Day[];
  today: GameDate;
  now: Date;
}

export interface DeedResult {
  outcome: Outcome;
  reward: Reward;
  /** Новый уровень, если он вырос. */
  levelUp: number | null;
  /** Усталость снята этим делом. */
  revived: boolean;
  /** Босс повержен этим делом: его трофей и награда за победу. */
  victory: { boss: Quest; loot: NewInventoryItem; reward: Reward } | null;
}

const NOTHING: Pick<Outcome, "quests" | "ritual" | "inventory" | "removeInventory"> = {
  quests: [],
  ritual: null,
  inventory: [],
  removeInventory: [],
};

function todayRow(days: readonly Day[], today: GameDate): Day {
  return days.find((d) => d.gameDate === today) ?? { gameDate: today, kind: "normal", deedsCount: 0, closedAt: null };
}

function withDeeds(ctx: TurnContext, delta: number): { row: Day; days: Day[] } {
  const current = todayRow(ctx.days, ctx.today);
  const row: Day = { ...current, deedsCount: Math.max(0, current.deedsCount + delta) };
  const days = [...ctx.days.filter((d) => d.gameDate !== ctx.today), row];
  return { row, days };
}

function withStreak(state: CharacterState, days: readonly Day[], today: GameDate): CharacterState {
  const streak = currentStreak(days, today);
  return { ...state, streakCurrent: streak, streakBest: Math.max(state.streakBest, streak) };
}

function ledgerFor(ctx: TurnContext, source: NewLedgerEntry["sourceType"], sourceId: number, reward: Reward): NewLedgerEntry {
  return {
    gameDate: ctx.today,
    sourceType: source,
    sourceId,
    xpDelta: reward.xp,
    goldDelta: reward.gold,
    attribute: reward.attribute,
    attributeDelta: reward.attributeDelta,
    revertsId: null,
    note: null,
  };
}

interface Gain {
  reward: Reward;
  entry: NewLedgerEntry;
}

/** Одно дело (квест, этап, ритуал, привал): +1 к делам дня, снимает усталость. Наград может быть несколько. */
function deed(
  ctx: TurnContext,
  gains: readonly Gain[],
  change: Partial<Pick<Outcome, "quests" | "ritual" | "inventory">>,
  victory: DeedResult["victory"] = null,
): DeedResult {
  const before = stateOf(ctx.character);
  const { row, days } = withDeeds(ctx, 1);
  const rewarded = gains.reduce((state, g) => applyReward(state, g.reward, 1, ctx.settings.levelCurve), before);
  const character = withStreak({ ...rewarded, fatiguedSince: null }, days, ctx.today);
  const reward = gains.reduce<Reward>(
    (sum, g) => ({
      xp: sum.xp + g.reward.xp,
      gold: sum.gold + g.reward.gold,
      attribute: sum.attribute ?? g.reward.attribute,
      attributeDelta: sum.attributeDelta + g.reward.attributeDelta,
    }),
    { xp: 0, gold: 0, attribute: null, attributeDelta: 0 },
  );
  return {
    outcome: { ...NOTHING, ...change, ledger: gains.map((g) => g.entry), days: [row], character },
    reward,
    levelUp: character.level > before.level ? character.level : null,
    revived: before.fatiguedSince !== null,
    victory,
  };
}

function done(ctx: TurnContext, id: number): QuestStatusChange {
  return { id, status: "done", completedAt: ctx.now.toISOString() };
}

function active(id: number): QuestStatusChange {
  return { id, status: "active", completedAt: null };
}

export function planCompleteQuest(ctx: TurnContext, quest: Quest): DeedResult {
  if (quest.status === "done") {
    throw new Error("Квест уже выполнен");
  }
  if (quest.type === "stage" || quest.type === "boss") {
    throw new Error("Этапы босса выполняются из его карточки");
  }
  const reward = questReward(quest, ctx.settings, ctx.character.windStep);
  return deed(ctx, [{ reward, entry: ledgerFor(ctx, "quest", quest.id, reward) }], { quests: [done(ctx, quest.id)] });
}

function bossOf(stage: Quest, quests: readonly Quest[]): Quest {
  const boss = quests.find((q) => q.id === stage.parentId && q.type === "boss");
  if (!boss) {
    throw new Error("У этапа нет босса");
  }
  return boss;
}

/**
 * Удар по боссу: этап выполнен и снимает свой урон с HP.
 * Последний этап ещё и побеждает босса: награда за победу и трофей в сундук.
 */
export function planCompleteStage(ctx: TurnContext, stage: Quest, quests: readonly Quest[]): DeedResult {
  if (stage.type !== "stage" || stage.status === "done") {
    throw new Error("Этот этап уже пройден");
  }
  const boss = bossOf(stage, quests);
  const stages = stagesOf(quests, boss.id);
  const hit = questReward(stage, ctx.settings, ctx.character.windStep);
  const gains: Gain[] = [{ reward: hit, entry: ledgerFor(ctx, "quest", stage.id, hit) }];
  const remaining = stages.filter((s) => s.status === "active" && s.id !== stage.id);
  if (remaining.length > 0 || boss.status === "done") {
    return deed(ctx, gains, { quests: [done(ctx, stage.id)] });
  }
  const prize = questReward(boss, ctx.settings, ctx.character.windStep);
  const loot = lootFor(boss, stages);
  gains.push({ reward: prize, entry: ledgerFor(ctx, "boss_defeat", boss.id, prize) });
  return deed(ctx, gains, { quests: [done(ctx, stage.id), done(ctx, boss.id)], inventory: [loot] }, { boss, loot, reward: prize });
}

export function planRestAction(ctx: TurnContext, action: RestAction): DeedResult {
  const reward = restActionReward(ctx.settings);
  const entry = { ...ledgerFor(ctx, "rest_action", action.id, reward), note: action.title };
  return deed(ctx, [{ reward, entry }], {});
}

type Revertable = "quest" | "boss_defeat" | "ritual";

/**
 * Обратные строки журнала для сегодняшних начислений по каждой цели.
 * Победа над боссом не отдельное дело: дела дня уменьшаются только за квест или ритуал.
 */
function revert(
  ctx: TurnContext,
  targets: ReadonlyArray<{ source: Revertable; id: number }>,
  todayLedger: readonly LedgerEntry[],
): { character: CharacterState; ledger: NewLedgerEntry[]; days: Day[] } {
  const reverted = new Set(todayLedger.map((e) => e.revertsId).filter((id): id is number => id !== null));
  let state = stateOf(ctx.character);
  const ledger: NewLedgerEntry[] = [];
  let deeds = 0;
  for (const { source, id } of targets) {
    const entries = todayLedger.filter((e) => e.sourceType === source && e.sourceId === id && !reverted.has(e.id));
    if (entries.length === 0) {
      throw new Error("Это дело совершено не сегодня, его нельзя отменить");
    }
    for (const e of entries) {
      const reward: Reward = { xp: e.xpDelta, gold: e.goldDelta, attribute: e.attribute, attributeDelta: e.attributeDelta };
      state = applyReward(state, reward, -1, ctx.settings.levelCurve);
      ledger.push({
        gameDate: ctx.today,
        sourceType: "revert",
        sourceId: id,
        xpDelta: -e.xpDelta,
        goldDelta: -e.goldDelta,
        attribute: e.attribute,
        attributeDelta: -e.attributeDelta,
        revertsId: e.id,
        note: source,
      });
      if (source !== "boss_defeat") deeds += 1;
    }
  }
  const { row, days } = withDeeds(ctx, -deeds);
  return { character: withStreak(state, days, ctx.today), ledger, days: [row] };
}

/**
 * Отмена выполнения в те же игровые сутки: обратные строки журнала, квест снова активен.
 * Усталость не возвращается: отмена защищает от случайного клика, а не наказывает.
 */
export function planUndoQuest(ctx: TurnContext, quest: Quest, todayLedger: readonly LedgerEntry[]): Outcome {
  const undone = revert(ctx, [{ source: "quest", id: quest.id }], todayLedger);
  return { ...NOTHING, quests: [active(quest.id)], ...undone };
}

/** Отмена этапа. Если он победил босса, победа и трофей отменяются вместе с ним. */
export function planUndoStage(
  ctx: TurnContext,
  stage: Quest,
  quests: readonly Quest[],
  inventory: readonly InventoryItem[],
  todayLedger: readonly LedgerEntry[],
): Outcome {
  const boss = bossOf(stage, quests);
  if (boss.status !== "done") {
    return planUndoQuest(ctx, stage, todayLedger);
  }
  const undone = revert(
    ctx,
    [
      { source: "quest", id: stage.id },
      { source: "boss_defeat", id: boss.id },
    ],
    todayLedger,
  );
  return {
    ...NOTHING,
    quests: [active(stage.id), active(boss.id)],
    removeInventory: lootOf(inventory, boss.id).map((i) => i.id),
    ...undone,
  };
}

export function planRitual(ctx: TurnContext, ritual: Ritual): DeedResult {
  const reward = ritualReward(ritual, ctx.settings, ctx.character.windStep);
  return deed(ctx, [{ reward, entry: ledgerFor(ctx, "ritual", ritual.id, reward) }], {
    ritual: { ritualId: ritual.id, gameDate: ctx.today, done: true },
  });
}

export function planUndoRitual(ctx: TurnContext, ritual: Ritual, todayLedger: readonly LedgerEntry[]): Outcome {
  const undone = revert(ctx, [{ source: "ritual", id: ritual.id }], todayLedger);
  return { ...NOTHING, ritual: { ritualId: ritual.id, gameDate: ctx.today, done: false }, ...undone };
}

function spend(ctx: TurnContext, price: number, source: "purchase" | "rest", sourceId: number | null, note: string) {
  const character = applyReward(stateOf(ctx.character), { xp: 0, gold: price, attribute: null, attributeDelta: 0 }, -1, ctx.settings.levelCurve);
  const entry: NewLedgerEntry = {
    gameDate: ctx.today,
    sourceType: source,
    sourceId,
    xpDelta: 0,
    goldDelta: -price,
    attribute: null,
    attributeDelta: 0,
    revertsId: null,
    note,
  };
  return { character, entry };
}

/** Покупка реальной награды: золото списывается, награда ложится в сундук. */
export function planBuyReward(ctx: TurnContext, reward: RealReward): Outcome {
  const { character, entry } = spend(ctx, reward.price, "purchase", reward.id, reward.title);
  return {
    ...NOTHING,
    inventory: [{ itemType: "reward", itemName: reward.title, rarity: "common", assetKey: null, sourceType: "purchase", sourceId: reward.id }],
    ledger: [entry],
    days: [],
    character,
  };
}

/** Покупка локации: уровень даёт право, золото открывает. Новым домом она не становится сама. */
export function planBuyLocation(ctx: TurnContext, location: Location, inventory: readonly InventoryItem[]): Outcome {
  if (ownsLocation(location, inventory)) {
    throw new Error("Эта локация уже открыта");
  }
  if (ctx.character.level < location.unlockLevel) {
    throw new Error(`Путь туда откроется на ${location.unlockLevel} уровне`);
  }
  const { character, entry } = spend(ctx, location.price, "purchase", null, location.name);
  return {
    ...NOTHING,
    inventory: [
      { itemType: "location", itemName: location.name, rarity: "common", assetKey: location.assetKey, sourceType: "purchase", sourceId: null },
    ],
    ledger: [entry],
    days: [],
    character,
  };
}

/**
 * День отдыха у камина: запланированный день без квестов, серия не прерывается.
 * Отдых на сегодня ещё и снимает усталость: это осознанный привал.
 */
export function planBuyRest(ctx: TurnContext, date: GameDate): Outcome {
  if (date < ctx.today) {
    throw new Error("Отдых можно взять только на сегодня или вперёд");
  }
  const existing = ctx.days.find((d) => d.gameDate === date);
  if (existing?.kind === "rest") {
    throw new Error("Этот день уже отдан отдыху");
  }
  const { character, entry } = spend(ctx, ctx.settings.restPrice, "rest", null, date);
  const row: Day = existing ? { ...existing, kind: "rest" } : { gameDate: date, kind: "rest", deedsCount: 0, closedAt: null };
  const days = [...ctx.days.filter((d) => d.gameDate !== date), row];
  const rested = date === ctx.today ? { ...character, fatiguedSince: null } : character;
  return { ...NOTHING, ledger: [entry], days: [row], character: withStreak(rested, days, ctx.today) };
}

/** Итоги прошедших суток при запуске или смене дня. null, если записывать нечего. */
export function planDayClose(ctx: TurnContext): { outcome: Outcome; days: Day[] } | null {
  const c = ctx.character;
  const closing = closePastDays(ctx.days, ctx.today, c.windStep, c.fatiguedSince, ctx.settings.streakBonus, ctx.now.toISOString());
  if (closing.changed.length === 0) {
    return null;
  }
  const character = withStreak(
    { ...stateOf(c), windStep: closing.windStep, fatiguedSince: closing.fatiguedSince },
    closing.days,
    ctx.today,
  );
  return {
    outcome: { ...NOTHING, ledger: [], days: closing.changed, character },
    days: closing.days,
  };
}

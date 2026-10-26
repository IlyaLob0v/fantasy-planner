import { applyReward, stateOf } from "./character";
import { questReward, restActionReward, ritualReward } from "./rewards";
import { closePastDays, currentStreak } from "./streak";
import type {
  Character,
  CharacterState,
  Day,
  GameDate,
  LedgerEntry,
  NewLedgerEntry,
  Outcome,
  Quest,
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
}

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

function deed(
  ctx: TurnContext,
  reward: Reward,
  ledger: NewLedgerEntry,
  change: Pick<Outcome, "quest" | "ritual">,
): DeedResult {
  const before = stateOf(ctx.character);
  const { row, days } = withDeeds(ctx, 1);
  const rewarded = applyReward(before, reward, 1, ctx.settings.levelCurve);
  const character = withStreak({ ...rewarded, fatiguedSince: null }, days, ctx.today);
  return {
    outcome: { ...change, inventory: [], ledger: [ledger], days: [row], character },
    reward,
    levelUp: character.level > before.level ? character.level : null,
    revived: before.fatiguedSince !== null,
  };
}

export function planCompleteQuest(ctx: TurnContext, quest: Quest): DeedResult {
  if (quest.status === "done") {
    throw new Error("Квест уже выполнен");
  }
  const reward = questReward(quest, ctx.settings, ctx.character.windStep);
  return deed(ctx, reward, ledgerFor(ctx, "quest", quest.id, reward), {
    quest: { id: quest.id, status: "done", completedAt: ctx.now.toISOString() },
    ritual: null,
  });
}

export function planRestAction(ctx: TurnContext, action: RestAction): DeedResult {
  const reward = restActionReward(ctx.settings);
  const entry = { ...ledgerFor(ctx, "rest_action", action.id, reward), note: action.title };
  return deed(ctx, reward, entry, { quest: null, ritual: null });
}

function revert(
  ctx: TurnContext,
  source: "quest" | "ritual",
  sourceId: number,
  todayLedger: readonly LedgerEntry[],
): { character: CharacterState; ledger: NewLedgerEntry[]; days: Day[] } {
  const reverted = new Set(todayLedger.map((e) => e.revertsId).filter((id): id is number => id !== null));
  const entries = todayLedger.filter((e) => e.sourceType === source && e.sourceId === sourceId && !reverted.has(e.id));
  if (entries.length === 0) {
    throw new Error("Это дело совершено не сегодня, его нельзя отменить");
  }
  let state = stateOf(ctx.character);
  const ledger: NewLedgerEntry[] = [];
  for (const e of entries) {
    const reward: Reward = { xp: e.xpDelta, gold: e.goldDelta, attribute: e.attribute, attributeDelta: e.attributeDelta };
    state = applyReward(state, reward, -1, ctx.settings.levelCurve);
    ledger.push({
      gameDate: ctx.today,
      sourceType: "revert",
      sourceId,
      xpDelta: -e.xpDelta,
      goldDelta: -e.goldDelta,
      attribute: e.attribute,
      attributeDelta: -e.attributeDelta,
      revertsId: e.id,
      note: source,
    });
  }
  const { row, days } = withDeeds(ctx, -entries.length);
  return { character: withStreak(state, days, ctx.today), ledger, days: [row] };
}

/**
 * Отмена выполнения в те же игровые сутки: обратные строки журнала, квест снова активен.
 * Усталость не возвращается: отмена защищает от случайного клика, а не наказывает.
 */
export function planUndoQuest(ctx: TurnContext, quest: Quest, todayLedger: readonly LedgerEntry[]): Outcome {
  const undone = revert(ctx, "quest", quest.id, todayLedger);
  return { quest: { id: quest.id, status: "active", completedAt: null }, ritual: null, inventory: [], ...undone };
}

export function planRitual(ctx: TurnContext, ritual: Ritual): DeedResult {
  const reward = ritualReward(ritual, ctx.settings, ctx.character.windStep);
  return deed(ctx, reward, ledgerFor(ctx, "ritual", ritual.id, reward), {
    quest: null,
    ritual: { ritualId: ritual.id, gameDate: ctx.today, done: true },
  });
}

export function planUndoRitual(ctx: TurnContext, ritual: Ritual, todayLedger: readonly LedgerEntry[]): Outcome {
  const undone = revert(ctx, "ritual", ritual.id, todayLedger);
  return { quest: null, ritual: { ritualId: ritual.id, gameDate: ctx.today, done: false }, inventory: [], ...undone };
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
    quest: null,
    ritual: null,
    inventory: [{ itemType: "reward", itemName: reward.title, sourceType: "purchase", sourceId: reward.id }],
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
  return { quest: null, ritual: null, inventory: [], ledger: [entry], days: [row], character: withStreak(rested, days, ctx.today) };
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
    outcome: { quest: null, ritual: null, inventory: [], ledger: [], days: closing.changed, character },
    days: closing.days,
  };
}

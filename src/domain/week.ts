import { applyReward, stateOf } from "./character";
import { isBlank } from "./chronicle";
import { chestFind, gearByKey, newGear, roll, type GearDef } from "./gear";
import { plural } from "./plural";
import { weekStart } from "./rituals";
import { addDays, daysBetween, gameDateOfIso } from "./time";
import { NOTHING, type TurnContext } from "./turns";
import type {
  Achievement,
  ChronicleEntry,
  GameDate,
  Gear,
  LedgerEntry,
  NewLedgerEntry,
  NewWeekGoal,
  Outcome,
  Quest,
  Ritual,
  WeekGoal,
} from "./types";

/** Неделя гильдии: цели на неделю, сундук за все цели и летопись прошедшей недели. */

export const WEEK_GOAL_KEYS = ["deeds", "main", "rituals", "boss", "days", "chronicle"] as const;
export type WeekGoalKey = (typeof WEEK_GOAL_KEYS)[number];

/** Сколько недель истории берётся для подбора цели. */
export const HISTORY_WEEKS = 4;
/** Сколько целей предлагается на неделю. */
export const GOALS_PER_WEEK = 3;

export interface WeekGoalDef {
  key: WeekGoalKey;
  /** Короткое имя для выбора замены. */
  name: string;
  label: (target: number) => string;
  /** Нижняя граница цели: даже новичку есть к чему стремиться. */
  floor: number;
  /** Цель по дням не может быть больше оставшихся дней недели. */
  perDay: boolean;
}

export const WEEK_GOALS: Record<WeekGoalKey, WeekGoalDef> = {
  deeds: { key: "deeds", name: "Дела", label: (n) => `Совершить ${n} ${plural(n, "дело", "дела", "дел")}`, floor: 5, perDay: false },
  main: { key: "main", name: "Главные квесты", label: (n) => `Закрыть ${n} ${plural(n, "главный квест", "главных квеста", "главных квестов")}`, floor: 2, perDay: false },
  rituals: { key: "rituals", name: "Ритуалы", label: (n) => `Отметить ритуалы ${n} ${plural(n, "раз", "раза", "раз")}`, floor: 3, perDay: false },
  boss: { key: "boss", name: "Боссы", label: (n) => `Нанести боссам ${n} урона`, floor: 3, perDay: false },
  days: { key: "days", name: "Дни с делами", label: (n) => `Действовать ${n} ${plural(n, "день", "дня", "дней")} из семи`, floor: 3, perDay: true },
  chronicle: { key: "chronicle", name: "Хроника", label: (n) => `Вести хронику ${n} ${plural(n, "день", "дня", "дней")}`, floor: 2, perDay: true },
};

export function weekGoalDef(key: string): WeekGoalDef | undefined {
  const known = WEEK_GOAL_KEYS.find((k) => k === key);
  return known === undefined ? undefined : WEEK_GOALS[known];
}

export type WeekFacts = Record<WeekGoalKey, number>;

/** Записи журнала в силе: без отмен и без отменённых записей. */
export function liveEntries(ledger: readonly LedgerEntry[]): LedgerEntry[] {
  const reverted = new Set(ledger.flatMap((e) => (e.revertsId === null ? [] : [e.revertsId])));
  return ledger.filter((e) => e.sourceType !== "revert" && !reverted.has(e.id));
}

function inWeek(from: GameDate, date: GameDate, until: GameDate = addDays(from, 7)): boolean {
  return date >= from && date < until;
}

/** Что сделано за неделю, начинающуюся `from` (или за её часть до `until`, не включая): из журнала, квестов и хроники. */
export function weekFacts(
  ledger: readonly LedgerEntry[],
  quests: readonly Quest[],
  chronicle: readonly ChronicleEntry[],
  from: GameDate,
  until?: GameDate,
): WeekFacts {
  const byId = new Map(quests.map((q) => [q.id, q]));
  const deeds = liveEntries(ledger).filter((e) => inWeek(from, e.gameDate, until) && (e.sourceType === "quest" || e.sourceType === "ritual"));
  const questOf = (e: LedgerEntry) => (e.sourceType === "quest" && e.sourceId !== null ? byId.get(e.sourceId) : undefined);
  return {
    deeds: deeds.length,
    main: deeds.filter((e) => questOf(e)?.type === "main").length,
    rituals: deeds.filter((e) => e.sourceType === "ritual").length,
    boss: deeds.reduce((sum, e) => {
      const q = questOf(e);
      return q?.type === "stage" ? sum + q.damage : sum;
    }, 0),
    days: new Set(deeds.map((e) => e.gameDate)).size,
    chronicle: chronicle.filter((c) => inWeek(from, c.gameDate, until) && !isBlank(c)).length,
  };
}

/** Прошлые недели, в которые герой что-то делал: по ним подбираются цели. */
export function pastWeeks(ledger: readonly LedgerEntry[], quests: readonly Quest[], chronicle: readonly ChronicleEntry[], current: GameDate): WeekFacts[] {
  return Array.from({ length: HISTORY_WEEKS }, (_, i) => weekFacts(ledger, quests, chronicle, addDays(current, -7 * (i + 1)))).filter((f) => f.deeds > 0);
}

/** Цель на полную неделю: чуть выше среднего за прошлые недели, но не ниже порога. */
export function suggestTarget(key: WeekGoalKey, past: readonly WeekFacts[], stretchPct: number): number {
  const def = WEEK_GOALS[key];
  const avg = past.length === 0 ? 0 : past.reduce((sum, f) => sum + f[key], 0) / past.length;
  const target = Math.max(def.floor, Math.ceil(avg * (1 + stretchPct / 100)));
  return def.perDay ? Math.min(7, target) : target;
}

/** Сделанное за неделю сейчас и до сегодняшнего дня: от второго зависит, сколько дней ещё можно набрать. */
export interface WeekProgress {
  now: WeekFacts;
  beforeToday: WeekFacts;
}

/**
 * Цель, поставленная посреди недели (первый вход в среду или замена цели): сделанное уже засчитано,
 * а на остаток недели, считая сегодня, приходится доля полной цели. Так замена не превращается в готовую награду.
 * Цель по дням не просит больше дней, чем осталось в неделе.
 */
export function targetFor(key: WeekGoalKey, past: readonly WeekFacts[], progress: WeekProgress, today: GameDate, stretchPct: number): number {
  const daysLeft = daysLeftInWeek(today);
  const share = Math.max(1, Math.ceil((suggestTarget(key, past, stretchPct) * daysLeft) / 7));
  const target = progress.beforeToday[key] + (WEEK_GOALS[key].perDay ? Math.min(share, daysLeft) : share);
  return Math.max(progress.now[key] + 1, target);
}

/** Какие цели имеют смысл для этого героя: без ритуалов нет цели по ритуалам и т. п. */
export function availableGoals(quests: readonly Quest[], rituals: readonly Ritual[], past: readonly WeekFacts[]): WeekGoalKey[] {
  const active = quests.filter((q) => q.status === "active" && q.archivedAt === null);
  const ever = (key: WeekGoalKey) => past.some((f) => f[key] > 0);
  return WEEK_GOAL_KEYS.filter((key) => {
    switch (key) {
      case "main":
        return ever("main") || active.some((q) => q.type === "main");
      case "rituals":
        return rituals.some((r) => r.archivedAt === null);
      case "boss":
        return active.some((q) => q.type === "boss");
      case "chronicle":
        return ever("chronicle");
      case "deeds":
      case "days":
        return true;
    }
  });
}

/** Цели новой недели: «дела» всегда, остальные по очереди, которая меняется от недели к неделе. */
export function pickGoals(week: GameDate, available: readonly WeekGoalKey[]): WeekGoalKey[] {
  const rest = available.filter((k) => k !== "deeds").sort((a, b) => roll(`${week}:${a}`) - roll(`${week}:${b}`));
  return ["deeds" as const, ...rest].slice(0, GOALS_PER_WEEK);
}

export function planNewWeek(
  today: GameDate,
  available: readonly WeekGoalKey[],
  past: readonly WeekFacts[],
  progress: WeekProgress,
  stretchPct: number,
  uid: () => string,
): NewWeekGoal[] {
  const week = weekStart(today);
  return pickGoals(week, available).map((key) => ({
    uid: uid(),
    weekStart: week,
    goalKey: key,
    target: targetFor(key, past, progress, today, stretchPct),
  }));
}

/** Чем заменить цель: любая доступная, которой ещё нет на этой неделе. */
export function swapOptions(goals: readonly WeekGoal[], available: readonly WeekGoalKey[]): WeekGoalKey[] {
  return available.filter((k) => !goals.some((g) => g.goalKey === k));
}

export interface WeekTurn {
  outcome: Outcome;
  done: WeekGoal[];
  /** Сундук недели открыт этим ходом. */
  chest: boolean;
  find: GearDef | null;
  gold: number;
}

/** Цели, которые набрали своё, закрываются с золотом; последняя из всех открывает сундук недели. */
export function planWeekGoals(ctx: TurnContext, goals: readonly WeekGoal[], facts: WeekFacts): WeekTurn | null {
  const done = goals.filter((g) => {
    const def = weekGoalDef(g.goalKey);
    return g.state === "active" && def !== undefined && facts[def.key] >= g.target;
  });
  if (done.length === 0) {
    return null;
  }
  const chest = goals.length >= 2 && goals.every((g) => g.state === "done" || done.includes(g));
  const { goalGold, chestGold } = ctx.settings.week;
  const entry = (sourceId: number | null, gold: number, note: string): NewLedgerEntry => ({
    gameDate: ctx.today,
    sourceType: "week_chest",
    sourceId,
    xpDelta: 0,
    goldDelta: gold,
    attribute: null,
    attributeDelta: 0,
    revertsId: null,
    note,
  });
  const ledger = [...done.map((g) => entry(g.id, goalGold, `goal:${g.goalKey}`)), ...(chest ? [entry(null, chestGold, "chest")] : [])];
  const gold = ledger.reduce((sum, e) => sum + e.goldDelta, 0);
  const find = chest ? chestFind(`chest:${weekStart(ctx.today)}`, ctx.character.level, ctx.gear, ctx.settings.loot) : null;
  const character = applyReward(stateOf(ctx.character), { xp: 0, gold, attribute: null, attributeDelta: 0 }, 1, ctx.settings.levelCurve);
  return {
    outcome: {
      ...NOTHING,
      ledger,
      days: [],
      character,
      weekGoalsDone: done.map((g) => g.id),
      gear: find ? [newGear(find, "week_chest", null, ctx.today, ctx.character.lootMisses, ctx.uid())] : [],
    },
    done,
    chest,
    find,
    gold,
  };
}

export interface WeekRecap {
  weekStart: GameDate;
  deeds: number;
  xp: number;
  gold: number;
  bestDay: { date: GameDate; deeds: number } | null;
  finds: GearDef[];
  glory: string[];
  goalsDone: number;
  goalsTotal: number;
  /** Строки из хроники недели: что случилось. */
  lines: string[];
}

/** Летопись недели, начинающейся `from`: итог в одной карточке. */
export function weekRecap(
  from: GameDate,
  data: {
    ledger: readonly LedgerEntry[];
    chronicle: readonly ChronicleEntry[];
    gear: readonly Gear[];
    achievements: readonly Achievement[];
    goals: readonly WeekGoal[];
    dayStartHour: number;
  },
): WeekRecap {
  const live = liveEntries(data.ledger).filter((e) => inWeek(from, e.gameDate));
  const deeds = live.filter((e) => e.sourceType === "quest" || e.sourceType === "ritual");
  const perDay = new Map<GameDate, number>();
  for (const e of deeds) perDay.set(e.gameDate, (perDay.get(e.gameDate) ?? 0) + 1);
  let bestDay: WeekRecap["bestDay"] = null;
  for (const [date, count] of [...perDay].sort(([a], [b]) => a.localeCompare(b))) {
    if (!bestDay || count > bestDay.deeds) bestDay = { date, deeds: count };
  }
  const goals = data.goals.filter((g) => g.weekStart === from);
  return {
    weekStart: from,
    deeds: deeds.length,
    xp: live.reduce((sum, e) => sum + Math.max(0, e.xpDelta), 0),
    gold: live.reduce((sum, e) => sum + Math.max(0, e.goldDelta), 0),
    bestDay,
    finds: data.gear.filter((g) => inWeek(from, g.gameDate)).flatMap((g) => gearByKey(g.itemKey) ?? []),
    glory: data.achievements.filter((a) => inWeek(from, gameDateOfIso(a.unlockedAt, data.dayStartHour))).map((a) => a.key),
    goalsDone: goals.filter((g) => g.state === "done").length,
    goalsTotal: goals.filter((g) => g.state !== "off").length,
    lines: data.chronicle
      .filter((c) => inWeek(from, c.gameDate) && c.happened.trim() !== "")
      .sort((a, b) => a.gameDate.localeCompare(b.gameDate))
      .slice(0, 2)
      .map((c) => c.happened.trim()),
  };
}

/** Сколько дней недели осталось, считая сегодняшний. */
export function daysLeftInWeek(today: GameDate): number {
  return 7 - daysBetween(weekStart(today), today);
}

/** Летопись прошлой недели показывается, пока её не закрыли, и только если неделя была. */
export function recapWeek(today: GameDate, recapSeen: GameDate): GameDate | null {
  const last = addDays(weekStart(today), -7);
  return recapSeen === last ? null : last;
}

import { applyReward, stateOf } from "./character";
import { newGear, relicFor } from "./gear";
import { completedOn } from "./quests";
import { isSuccess } from "./streak";
import type { TurnContext } from "./turns";
import type { Achievement, Character, Day, InventoryItem, LedgerTally, NewAchievement, NewGear, NewLedgerEntry, Outcome, Quest } from "./types";

/** Всё, из чего считаются достижения. Собирается из журнала, квестов, суток и персонажа. */
export interface GloryStats {
  questsDone: number;
  mainOnTime: number;
  bossesDefeated: number;
  legendaryBosses: number;
  level: number;
  streakBest: number;
  strength: number;
  intellect: number;
  agility: number;
  ritualMarks: number;
  /** Больше всего отметок у одного ритуала. */
  ritualBest: number;
  purchases: number;
  restDays: number;
  /** Сколько раз усталость снята делом. */
  comebacks: number;
}

export const GLORY_BRANCHES = ["first", "streak", "quests", "main", "bosses", "levels", "rituals", "attributes", "comeback"] as const;
export type GloryBranch = (typeof GLORY_BRANCHES)[number];

export const BRANCH_TITLE: Record<GloryBranch, string> = {
  first: "Первые шаги",
  streak: "Серия",
  quests: "Подвиги",
  main: "Слово",
  bosses: "Боссы",
  levels: "Путь",
  rituals: "Обеты",
  attributes: "Мастерство",
  comeback: "Возвращение",
};

/** Ступень достижения задаёт золото за него. */
export type GloryTier = 1 | 2 | 3 | 4;
export const TIER_GOLD: Record<GloryTier, number> = { 1: 25, 2: 50, 3: 100, 4: 200 };

export interface GloryDef {
  key: string;
  branch: GloryBranch;
  title: string;
  description: string;
  tier: GloryTier;
  target: number;
  progress: (s: GloryStats) => number;
}

function def(
  branch: GloryBranch,
  key: string,
  title: string,
  description: string,
  tier: GloryTier,
  target: number,
  progress: (s: GloryStats) => number,
): GloryDef {
  return { key, branch, title, description, tier, target, progress };
}

const quests = (s: GloryStats) => s.questsDone;
const streak = (s: GloryStats) => s.streakBest;
const level = (s: GloryStats) => s.level;

/** Каталог Зала славы. Ключи стабильны: по ним хранится факт открытия. */
export const GLORY: readonly GloryDef[] = [
  def("first", "first_quest", "Первый приказ", "Выполнить первый квест", 1, 1, quests),
  def("first", "first_ritual", "Первый обет", "Отметить ритуал", 1, 1, (s) => s.ritualMarks),
  def("first", "first_purchase", "Монета в деле", "Купить награду или локацию в лавке", 1, 1, (s) => s.purchases),
  def("first", "first_rest", "Заслуженный отдых", "Взять день отдыха у камина", 1, 1, (s) => s.restDays),
  def("first", "first_boss", "Первая кровь", "Победить босса", 1, 1, (s) => s.bossesDefeated),

  def("streak", "streak_3", "Три рассвета", "Серия 3 дня", 1, 3, streak),
  def("streak", "streak_7", "Неделя без привала", "Серия 7 дней", 2, 7, streak),
  def("streak", "streak_14", "Две недели в седле", "Серия 14 дней", 2, 14, streak),
  def("streak", "streak_30", "Месяц доблести", "Серия 30 дней", 3, 30, streak),
  def("streak", "streak_60", "Два месяца в строю", "Серия 60 дней", 3, 60, streak),
  def("streak", "streak_100", "Сто рассветов", "Серия 100 дней", 4, 100, streak),

  def("quests", "quests_10", "Десяток подвигов", "Выполнить 10 квестов", 1, 10, quests),
  def("quests", "quests_50", "Полсотни приказов", "Выполнить 50 квестов", 1, 50, quests),
  def("quests", "quests_100", "Первая сотня", "Выполнить 100 квестов", 2, 100, quests),
  def("quests", "quests_250", "Опора гильдии", "Выполнить 250 квестов", 2, 250, quests),
  def("quests", "quests_500", "Пятьсот приказов", "Выполнить 500 квестов", 3, 500, quests),
  def("quests", "quests_1000", "Тысяча подвигов", "Выполнить 1000 квестов", 4, 1000, quests),

  def("main", "main_5", "Слово держу", "Выполнить 5 главных квестов в срок", 1, 5, (s) => s.mainOnTime),
  def("main", "main_25", "Точен как часы", "Выполнить 25 главных квестов в срок", 2, 25, (s) => s.mainOnTime),
  def("main", "main_100", "Человек слова", "Выполнить 100 главных квестов в срок", 3, 100, (s) => s.mainOnTime),

  def("bosses", "bosses_5", "Гроза чудищ", "Победить 5 боссов", 2, 5, (s) => s.bossesDefeated),
  def("bosses", "bosses_15", "Охотник на великанов", "Победить 15 боссов", 3, 15, (s) => s.bossesDefeated),
  def("bosses", "boss_legendary", "Драконья кровь", "Победить босса с запасом HP больше 25", 3, 1, (s) => s.legendaryBosses),

  def("levels", "level_5", "Страж ворот", "Достичь 5 уровня", 1, 5, level),
  def("levels", "level_10", "Испытанный клинок", "Достичь 10 уровня", 2, 10, level),
  def("levels", "level_15", "Ветеран гильдии", "Достичь 15 уровня", 2, 15, level),
  def("levels", "level_20", "Магистр гильдии", "Достичь 20 уровня", 3, 20, level),
  def("levels", "level_30", "Владыка замка", "Достичь 30 уровня", 4, 30, level),

  def("rituals", "ritual_one_50", "Верность обету", "Отметить один ритуал 50 раз", 2, 50, (s) => s.ritualBest),
  def("rituals", "rituals_100", "Сотня обетов", "Отметить ритуалы 100 раз", 2, 100, (s) => s.ritualMarks),
  def("rituals", "rituals_500", "Нерушимый обет", "Отметить ритуалы 500 раз", 3, 500, (s) => s.ritualMarks),

  def("attributes", "strength_100", "Крепкая рука", "Сила 100", 2, 100, (s) => s.strength),
  def("attributes", "intellect_100", "Ясный ум", "Интеллект 100", 2, 100, (s) => s.intellect),
  def("attributes", "agility_100", "Быстрые пальцы", "Ловкость 100", 2, 100, (s) => s.agility),
  def("attributes", "all_50", "Разносторонний", "Все три атрибута не ниже 50", 2, 50, (s) => Math.min(s.strength, s.intellect, s.agility)),

  def("comeback", "comeback_1", "Снова в седле", "Вернуться к делам после усталости", 1, 1, (s) => s.comebacks),
  def("comeback", "comeback_10", "Неугасимый", "Вернуться к делам после усталости 10 раз", 2, 10, (s) => s.comebacks),
];

function counted(tally: readonly LedgerTally[], source: LedgerTally["sourceType"]): LedgerTally[] {
  return tally.filter((t) => t.sourceType === source);
}

function sum(rows: readonly LedgerTally[]): number {
  return rows.reduce((total, t) => total + t.count, 0);
}

/** Сколько раз после пропущенного дня следующий успешный день снял усталость. */
export function comebacks(days: readonly Day[]): number {
  const sorted = [...days].sort((a, b) => a.gameDate.localeCompare(b.gameDate));
  let tired = false;
  let count = 0;
  for (const day of sorted) {
    if (isSuccess(day)) {
      if (tired) count += 1;
      tired = false;
    } else if (day.closedAt !== null) {
      tired = true;
    }
  }
  return count;
}

export function gloryStats(
  character: Character,
  tally: readonly LedgerTally[],
  quests: readonly Quest[],
  days: readonly Day[],
  inventory: readonly InventoryItem[],
  dayStartHour: number,
): GloryStats {
  const rituals = counted(tally, "ritual");
  return {
    questsDone: sum(counted(tally, "quest")),
    mainOnTime: quests.filter((q) => {
      if (q.type !== "main" || q.status !== "done") return false;
      const done = completedOn(q, dayStartHour);
      return done !== null && (q.dueDate === null || done <= q.dueDate);
    }).length,
    bossesDefeated: sum(counted(tally, "boss_defeat")),
    legendaryBosses: inventory.filter((i) => i.itemType === "loot" && i.sourceType === "boss" && i.rarity === "legendary").length,
    level: character.level,
    streakBest: character.streakBest,
    strength: character.strength,
    intellect: character.intellect,
    agility: character.agility,
    ritualMarks: sum(rituals),
    ritualBest: rituals.reduce((best, t) => Math.max(best, t.count), 0),
    purchases: sum(counted(tally, "purchase")),
    restDays: sum(counted(tally, "rest")),
    comebacks: comebacks(days),
  };
}

export interface GloryProgress {
  def: GloryDef;
  current: number;
  unlockedAt: string | null;
}

export function gloryProgress(stats: GloryStats, unlocked: readonly Achievement[]): GloryProgress[] {
  const opened = new Map(unlocked.map((a) => [a.key, a.unlockedAt]));
  return GLORY.map((d) => ({ def: d, current: Math.min(d.target, d.progress(stats)), unlockedAt: opened.get(d.key) ?? null }));
}

/** Заслуженные, но ещё не записанные достижения. Достижение не отбирается, поэтому обратного списка нет. */
export function newlyEarned(stats: GloryStats, unlocked: readonly Achievement[]): GloryDef[] {
  const opened = new Set(unlocked.map((a) => a.key));
  return GLORY.filter((d) => !opened.has(d.key) && d.progress(stats) >= d.target);
}

/** Ближайшая веха: из закрытых та, до которой осталось меньше всего в долях. */
export function nearestGlory(progress: readonly GloryProgress[]): GloryProgress | null {
  let best: GloryProgress | null = null;
  for (const p of progress) {
    if (p.unlockedAt !== null || p.current === 0 || p.current >= p.def.target) continue;
    if (!best || p.current / p.def.target > best.current / best.def.target) best = p;
  }
  return best;
}

/** Записывает новые достижения, золото за них и реликвии главных вех одной транзакцией. */
export function planGlory(ctx: TurnContext, earned: readonly GloryDef[]): Outcome {
  const gold = earned.reduce((total, d) => total + TIER_GOLD[d.tier], 0);
  const character = applyReward(stateOf(ctx.character), { xp: 0, gold, attribute: null, attributeDelta: 0 }, 1, ctx.settings.levelCurve);
  const ledger: NewLedgerEntry[] = earned.map((d) => ({
    gameDate: ctx.today,
    sourceType: "achievement",
    sourceId: null,
    xpDelta: 0,
    goldDelta: TIER_GOLD[d.tier],
    attribute: null,
    attributeDelta: 0,
    revertsId: null,
    note: d.key,
  }));
  const achievements: NewAchievement[] = earned.map((d) => ({ key: d.key, uid: ctx.uid() }));
  const gear: NewGear[] = earned
    .flatMap((d) => relicFor(d.key) ?? [])
    .filter((relic) => !ctx.gear.some((g) => g.itemKey === relic.key))
    .map((relic) => newGear(relic, "achievement", null, ctx.today, ctx.character.lootMisses, ctx.uid()));
  return { quests: [], ritual: null, inventory: [], removeInventory: [], ledger, days: [], character, achievements, gear, removeGear: [], weekGoalsDone: [], crestParts: [] };
}

export function gloryByKey(key: string): GloryDef | undefined {
  return GLORY.find((d) => d.key === key);
}

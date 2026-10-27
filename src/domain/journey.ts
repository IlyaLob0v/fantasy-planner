import { activeBosses, bossHp, stagesOf } from "./bosses";
import { isForToday, isTask } from "./quests";
import { isSuccess } from "./streak";
import { addDays } from "./time";
import { ATTRIBUTES, type Attribute, type Character, type Day, type GameDate, type Quest, type Settings } from "./types";

/** День в походе: хотя бы одно дело. День отдыха серию держит, но походным днём не считается. */
export function isJourneyDay(day: Day): boolean {
  return day.deedsCount > 0;
}

/** Дни в походе за всё время, не обязательно подряд. Главная цифра пути, серия вторична. */
export function journeyDays(days: readonly Day[]): number {
  return days.filter(isJourneyDay).length;
}

export function deedsTotal(days: readonly Day[]): number {
  return days.reduce((sum, d) => sum + d.deedsCount, 0);
}

export interface BestMonth {
  /** YYYY-MM. */
  month: string;
  days: number;
}

/** Месяц с наибольшим числом дней в походе; при равенстве более поздний. */
export function bestMonth(days: readonly Day[]): BestMonth | null {
  const counts = new Map<string, number>();
  for (const d of days) {
    if (!isJourneyDay(d)) continue;
    const month = d.gameDate.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  let best: BestMonth | null = null;
  for (const [month, n] of counts) {
    if (!best || n > best.days || (n === best.days && month > best.month)) best = { month, days: n };
  }
  return best;
}

/** Самый развитый атрибут; пока все равны, любимого нет. */
export function favoriteAttribute(character: Character): Attribute | null {
  const sorted = [...ATTRIBUTES].sort((a, b) => character[b] - character[a]);
  const [first, second] = sorted;
  if (first === undefined || second === undefined || character[first] === character[second]) return null;
  return first;
}

export interface Absence {
  /** Последний день с делом или отдыхом перед перерывом. */
  lastActive: GameDate;
  /** Сколько суток подряд до вчерашних включительно прошли без дел. */
  days: number;
}

/** Перерыв перед сегодняшним днём. Новичок, у которого ещё не было ни одного дела, не «возвращается». */
export function absenceBefore(days: readonly Day[], today: GameDate): Absence | null {
  const byDate = new Map(days.map((d) => [d.gameDate, d]));
  const earliest = days.reduce<GameDate>((min, d) => (d.gameDate < min ? d.gameDate : min), today);
  let cursor = addDays(today, -1);
  let count = 0;
  while (cursor >= earliest) {
    if (isSuccess(byDate.get(cursor))) return { lastActive: cursor, days: count };
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return null;
}

/**
 * Карточка возвращения показывается один раз на перерыв: после `returnAfterDays` суток без дел,
 * пока сегодня ещё ничего не сделано и пока её не закрыли (`returnSeen` хранит начало перерыва).
 */
export function returnAbsence(days: readonly Day[], today: GameDate, settings: Settings): Absence | null {
  if (isSuccess(days.find((d) => d.gameDate === today))) return null;
  const absence = absenceBefore(days, today);
  if (!absence || absence.days < settings.journey.returnAfterDays || settings.returnSeen === absence.lastActive) return null;
  return absence;
}

/** Малый шаг после перерыва: самый лёгкий открытый квест; сначала уже взятые на сегодня, побочные раньше главных. */
export function smallStep(quests: readonly Quest[], today: GameDate): Quest | null {
  const open = quests.filter((q) => isTask(q) && q.status === "active" && q.archivedAt === null);
  const sorted = open.sort(
    (a, b) =>
      a.difficulty - b.difficulty ||
      Number(isForToday(b, today)) - Number(isForToday(a, today)) ||
      Number(a.type === "main") - Number(b.type === "main") ||
      a.sortOrder - b.sortOrder ||
      a.id - b.id,
  );
  return sorted[0] ?? null;
}

/**
 * Квесты, которые копятся в сегодняшнем дне только потому, что были взяты на прошедшие дни.
 * С прошедшим дедлайном не входят: это настоящий срок, его не прячем.
 */
export function staleQuests(quests: readonly Quest[], today: GameDate): Quest[] {
  return quests.filter(
    (q) => isTask(q) && q.status === "active" && q.archivedAt === null && q.scheduledDate !== null && q.scheduledDate < today && (q.dueDate === null || q.dueDate >= today),
  );
}

export interface BossGoal {
  boss: Quest;
  hp: number;
}

/** Ближайшая цель для карточки возвращения: босс, которому осталось меньше всего HP. */
export function weakestBoss(quests: readonly Quest[]): BossGoal | null {
  let best: BossGoal | null = null;
  for (const boss of activeBosses(quests)) {
    const hp = bossHp(stagesOf(quests, boss.id)).current;
    if (hp > 0 && (!best || hp < best.hp)) best = { boss, hp };
  }
  return best;
}

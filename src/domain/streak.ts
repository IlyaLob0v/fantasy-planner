import { maxWindStep } from "./rewards";
import { addDays, daysBetween } from "./time";
import type { Day, GameDate, Settings } from "./types";

export function isSuccess(day: Day | undefined): boolean {
  return day !== undefined && (day.deedsCount > 0 || day.kind === "rest");
}

function index(days: readonly Day[]): Map<GameDate, Day> {
  return new Map(days.map((d) => [d.gameDate, d]));
}

/** День в таверне без дел: серию не растит и не рвёт, ветер и усталость не трогает. */
export function isNeutral(day: Day | undefined, date: GameDate, inn: ReadonlySet<GameDate>): boolean {
  return inn.has(date) && !isSuccess(day);
}

function streakEndingAt(byDate: ReadonlyMap<GameDate, Day>, end: GameDate, inn: ReadonlySet<GameDate>): number {
  let count = 0;
  let cursor = end;
  for (;;) {
    const day = byDate.get(cursor);
    if (isSuccess(day)) {
      count += 1;
    } else if (!inn.has(cursor)) {
      return count;
    }
    cursor = addDays(cursor, -1);
  }
}

/** Серия: подряд идущие успешные дни, заканчивая сегодня (если сегодня уже есть дело) или вчера. Дни в таверне пропускаются. */
export function currentStreak(days: readonly Day[], today: GameDate, inn: ReadonlySet<GameDate> = new Set()): number {
  const byDate = index(days);
  return isSuccess(byDate.get(today)) ? streakEndingAt(byDate, today, inn) : streakEndingAt(byDate, addDays(today, -1), inn);
}

export interface CloseOptions {
  /** «Плащ странника»: одиночный пропуск после успешного дня не опускает ветер. */
  guardSingleMiss?: boolean;
  /** Даты комнаты в таверне. */
  inn?: ReadonlySet<GameDate>;
  /** Закрывать сутки строго раньше этой даты. По умолчанию сегодня; вчера, пока ждёт карточка «Что было вчера?». */
  until?: GameDate;
}

export interface DayClosing {
  /** Строки days, которые нужно записать (новые и закрытые). */
  changed: Day[];
  /** Полный список дней после закрытия. */
  days: Day[];
  windStep: number;
  fatiguedSince: GameDate | null;
}

/**
 * Подводит итоги прошедших суток. Успешный день, завершивший очередные N дней серии, поднимает
 * «Попутный ветер» на ступень. Пропуск опускает его на одну ступень и включает усталость.
 * Ничего не отнимается: золото и XP не трогаются. С «Плащом странника» (`guardSingleMiss`) одиночный
 * пропуск после успешного дня ветер не опускает; усталость при этом всё равно включается.
 * День в таверне без дел ничего не меняет.
 */
export function closePastDays(
  days: readonly Day[],
  today: GameDate,
  windStep: number,
  fatiguedSince: GameDate | null,
  bonus: Settings["streakBonus"],
  closedAt: string,
  options: CloseOptions = {},
): DayClosing {
  const { guardSingleMiss = false, inn = new Set<GameDate>(), until = today } = options;
  const byDate = index(days);
  const changed: Day[] = [];
  const earliest = days.reduce<GameDate>((min, d) => (d.gameDate < min ? d.gameDate : min), today);
  const cap = maxWindStep(bonus);
  let step = windStep;
  let fatigue = fatiguedSince;

  for (let offset = 0; offset < daysBetween(earliest, until); offset += 1) {
    const date = addDays(earliest, offset);
    const existing = byDate.get(date);
    if (existing?.closedAt) {
      continue;
    }
    const closed: Day = existing
      ? { ...existing, closedAt }
      : { gameDate: date, kind: "normal", deedsCount: 0, closedAt };
    byDate.set(date, closed);
    changed.push(closed);
    if (isSuccess(closed)) {
      if (streakEndingAt(byDate, date, inn) % bonus.stepDays === 0) {
        step = Math.min(cap, step + 1);
      }
    } else if (!inn.has(date)) {
      const single = guardSingleMiss && isSuccess(byDate.get(addDays(date, -1)));
      if (!single) step = Math.max(0, step - 1);
      fatigue = date;
    }
  }

  if (!byDate.has(today)) {
    const fresh: Day = { gameDate: today, kind: "normal", deedsCount: 0, closedAt: null };
    byDate.set(today, fresh);
    changed.push(fresh);
  }

  const all = [...byDate.values()].sort((a, b) => (a.gameDate < b.gameDate ? -1 : 1));
  return { changed, days: all, windStep: step, fatiguedSince: fatigue };
}

export function nextWindIn(streak: number, bonus: Settings["streakBonus"]): number {
  return bonus.stepDays - (streak % bonus.stepDays);
}

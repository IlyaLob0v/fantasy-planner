import { maxWindStep } from "./rewards";
import { addDays, daysBetween } from "./time";
import type { Day, GameDate, Settings } from "./types";

export function isSuccess(day: Day | undefined): boolean {
  return day !== undefined && (day.deedsCount > 0 || day.kind === "rest");
}

function index(days: readonly Day[]): Map<GameDate, Day> {
  return new Map(days.map((d) => [d.gameDate, d]));
}

function streakEndingAt(byDate: ReadonlyMap<GameDate, Day>, end: GameDate): number {
  let count = 0;
  let cursor = end;
  while (isSuccess(byDate.get(cursor))) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

/** Серия: подряд идущие успешные дни, заканчивая сегодня (если сегодня уже есть дело) или вчера. */
export function currentStreak(days: readonly Day[], today: GameDate): number {
  const byDate = index(days);
  return isSuccess(byDate.get(today)) ? streakEndingAt(byDate, today) : streakEndingAt(byDate, addDays(today, -1));
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
 */
export function closePastDays(
  days: readonly Day[],
  today: GameDate,
  windStep: number,
  fatiguedSince: GameDate | null,
  bonus: Settings["streakBonus"],
  closedAt: string,
  guardSingleMiss = false,
): DayClosing {
  const byDate = index(days);
  const changed: Day[] = [];
  const earliest = days.reduce<GameDate>((min, d) => (d.gameDate < min ? d.gameDate : min), today);
  const cap = maxWindStep(bonus);
  let step = windStep;
  let fatigue = fatiguedSince;

  for (let offset = 0; offset < daysBetween(earliest, today); offset += 1) {
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
      if (streakEndingAt(byDate, date) % bonus.stepDays === 0) {
        step = Math.min(cap, step + 1);
      }
    } else {
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

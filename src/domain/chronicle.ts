import type { ChronicleEntry, GameDate } from "./types";

/** Час, после которого на главном экране появляется строка «Записать в хронику». */
export const EVENING_HOUR = 19;

/** Вечер игровых суток: с 19:00 до начала следующих суток (после полуночи день ещё тот же). */
export function isEvening(now: Date, dayStartHour: number): boolean {
  const hour = now.getHours();
  return hour >= EVENING_HOUR || hour < dayStartHour;
}

export function blankChronicle(gameDate: GameDate): ChronicleEntry {
  return { gameDate, happened: "", noticed: "", feeling: "", mood: null, updatedAt: "" };
}

export function isBlank(entry: Pick<ChronicleEntry, "happened" | "noticed" | "feeling" | "mood">): boolean {
  return !entry.happened.trim() && !entry.noticed.trim() && !entry.feeling.trim() && entry.mood === null;
}

export const MOODS = [1, 2, 3, 4, 5] as const;

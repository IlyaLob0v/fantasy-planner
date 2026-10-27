import { isSuccess } from "./streak";
import { addDays, daysBetween, weekday } from "./time";
import type { Day, GameDate, Settings } from "./types";

/** На сколько суток вперёд ставится напоминание: телефон зовёт, даже если приложение не открывали. */
export const REMINDER_DAYS = 7;

export interface Reminder {
  gameDate: GameDate;
  at: Date;
  body: string;
}

const PHRASES = [
  "Тронный зал ждёт приказов.",
  "Камин горит. Одно небольшое дело, и день твой.",
  "Гильдия собирается у доски квестов.",
  "Хватит одного дела, чтобы день засчитался в поход.",
  "Летописец ждёт сегодняшнюю строку.",
] as const;

/** Текст по кругу: на каждые сутки свой, без упрёков и без слова о серии. */
export function reminderBody(date: GameDate): string {
  const index = ((daysBetween("2026-01-05", date) % PHRASES.length) + PHRASES.length) % PHRASES.length;
  return PHRASES[index] ?? PHRASES[0];
}

/** Момент напоминания в игровые сутки: час до начала суток относится уже к следующей календарной дате. */
export function reminderMoment(date: GameDate, hour: number, dayStartHour: number): Date {
  const calendar = hour < dayStartHour ? addDays(date, 1) : date;
  const [y, m, d] = calendar.split("-").map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1, hour);
}

/**
 * Напоминания на ближайшую неделю: в выбранный час, не больше одного в сутки. Пропускаются тихие дни недели,
 * дни отдыха и таверны, уже прошедшие часы и сегодняшний день, если в нём уже есть дело.
 */
export function reminderPlan(
  now: Date,
  today: GameDate,
  settings: Settings,
  days: readonly Day[],
  inn: ReadonlySet<GameDate> = new Set(),
): Reminder[] {
  const { reminder, dayStartHour } = settings;
  if (!reminder.enabled) return [];
  const byDate = new Map(days.map((d) => [d.gameDate, d]));
  return Array.from({ length: REMINDER_DAYS }, (_, offset) => addDays(today, offset)).flatMap((date): Reminder[] => {
    const day = byDate.get(date);
    if (reminder.quietWeekdays.includes(weekday(date)) || day?.kind === "rest" || inn.has(date) || (date === today && isSuccess(day))) return [];
    const at = reminderMoment(date, reminder.hour, dayStartHour);
    return at > now ? [{ gameDate: date, at, body: reminderBody(date) }] : [];
  });
}

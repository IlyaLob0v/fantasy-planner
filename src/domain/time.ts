import type { GameDate } from "./types";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function formatLocal(date: Date): GameDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parse(date: GameDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Неверная дата ${date}`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

/** Игровые сутки: локальная дата, сдвинутая на час начала дня (по умолчанию 04:00). */
export function gameDate(moment: Date, dayStartHour: number): GameDate {
  const shifted = new Date(moment.getTime() - dayStartHour * 3_600_000);
  return formatLocal(shifted);
}

export function gameDateOfIso(iso: string, dayStartHour: number): GameDate {
  return gameDate(new Date(iso), dayStartHour);
}

export function addDays(date: GameDate, days: number): GameDate {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: GameDate, to: GameDate): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** День недели: 0 = понедельник. */
export function weekday(date: GameDate): number {
  return (parse(date).getUTCDay() + 6) % 7;
}

/** Первый день сетки календаря: понедельник, с которого `weeks` недель заканчиваются воскресеньем текущей недели. */
export function calendarStart(today: GameDate, weeks: number): GameDate {
  return addDays(today, -weekday(today) - (weeks - 1) * 7);
}

const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"];

export function humanDate(date: GameDate): string {
  const d = parse(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()] ?? ""}`;
}

export function humanWeekday(date: GameDate): string {
  return WEEKDAYS[weekday(date)] ?? "";
}

const SHORT_WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function shortWeekday(date: GameDate): string {
  return SHORT_WEEKDAYS[weekday(date)] ?? "";
}

const MONTHS_NOMINATIVE = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];

/** Месяц из «YYYY-MM»: «март 2026». */
export function humanMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_NOMINATIVE[(m ?? 1) - 1] ?? ""} ${String(y ?? "")}`;
}

import { plural } from "./plural";
import { addDays, daysBetween, weekday } from "./time";
import type { GameDate, Ritual, RitualCompletion, RitualFields } from "./types";

export const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

/** Понедельник недели, в которую входит дата. */
export function weekStart(date: GameDate): GameDate {
  return addDays(date, -weekday(date));
}

export function isPaused(r: Ritual, today: GameDate): boolean {
  return r.pausedUntil !== null && today <= r.pausedUntil;
}

function doneOn(r: Ritual, completions: readonly RitualCompletion[], date: GameDate): boolean {
  return completions.some((c) => c.ritualId === r.id && c.gameDate === date);
}

function doneThisWeek(r: Ritual, completions: readonly RitualCompletion[], today: GameDate): number {
  const from = weekStart(today);
  return completions.filter((c) => c.ritualId === r.id && c.gameDate >= from && c.gameDate <= today).length;
}

/** Нужен ли ритуал сегодня по своему расписанию. Пропуск ритуала ничем не наказывается. */
export function isDue(r: Ritual, completions: readonly RitualCompletion[], today: GameDate): boolean {
  if (isPaused(r, today) || today < r.startDate) {
    return false;
  }
  switch (r.schedule) {
    case "daily":
      return true;
    case "weekdays":
      return ((r.weekdaysMask ?? 0) & (1 << weekday(today))) !== 0;
    case "times_per_week":
      return doneOn(r, completions, today) || doneThisWeek(r, completions, today) < (r.timesPerWeek ?? 1);
    case "every_n_days":
      return daysBetween(r.startDate, today) % (r.intervalDays ?? 1) === 0;
  }
}

export interface RitualToday {
  ritual: Ritual;
  done: boolean;
  /** Для «N раз в неделю»: сколько уже сделано на этой неделе. */
  weekCount: number;
}

export function ritualsForToday(
  rituals: readonly Ritual[],
  completions: readonly RitualCompletion[],
  today: GameDate,
): RitualToday[] {
  return rituals
    .filter((r) => isDue(r, completions, today))
    .map((ritual) => ({
      ritual,
      done: doneOn(ritual, completions, today),
      weekCount: doneThisWeek(ritual, completions, today),
    }));
}

/** Подпись расписания для карточки: «каждый день», «пн, ср, пт», «3 раза в неделю», «раз в 2 дня». */
export function describeSchedule(r: Pick<Ritual, "schedule" | "weekdaysMask" | "timesPerWeek" | "intervalDays">): string {
  switch (r.schedule) {
    case "daily":
      return "каждый день";
    case "weekdays":
      return WEEKDAY_SHORT.filter((_, i) => ((r.weekdaysMask ?? 0) & (1 << i)) !== 0).join(", ");
    case "times_per_week": {
      const n = r.timesPerWeek ?? 1;
      return `${n} ${plural(n, "раз", "раза", "раз")} в неделю`;
    }
    case "every_n_days": {
      const n = r.intervalDays ?? 2;
      return `раз в ${n} ${plural(n, "день", "дня", "дней")}`;
    }
  }
}

/** Черновик нового ритуала. */
export function blankRitual(today: GameDate, sortOrder: number): RitualFields {
  return {
    title: "",
    realName: null,
    attribute: "strength",
    schedule: "daily",
    weekdaysMask: null,
    timesPerWeek: null,
    intervalDays: null,
    startDate: today,
    pausedUntil: null,
    difficulty: 1,
    sortOrder,
  };
}

export function ritualFieldsOf(r: Ritual): RitualFields {
  return {
    title: r.title,
    realName: r.realName,
    attribute: r.attribute,
    schedule: r.schedule,
    weekdaysMask: r.weekdaysMask,
    timesPerWeek: r.timesPerWeek,
    intervalDays: r.intervalDays,
    startDate: r.startDate,
    pausedUntil: r.pausedUntil,
    difficulty: r.difficulty,
    sortOrder: r.sortOrder,
  };
}

/** Что мешает записать обет; null, если всё в порядке. */
export function ritualProblem(d: RitualFields): string | null {
  if (!d.title.trim()) return "Дай ритуалу название";
  if (d.schedule === "weekdays" && !d.weekdaysMask) return "Отметь хотя бы один день недели";
  if (d.schedule === "times_per_week" && (d.timesPerWeek ?? 0) < 1) return "Сколько раз в неделю?";
  if (d.schedule === "every_n_days" && (d.intervalDays ?? 0) < 2) return "Интервал от двух дней";
  return null;
}

function sameSchedule(a: RitualFields, b: RitualFields): boolean {
  return (
    a.schedule === b.schedule &&
    a.weekdaysMask === b.weekdaysMask &&
    a.timesPerWeek === b.timesPerWeek &&
    a.intervalDays === b.intervalDays
  );
}

/**
 * Готовит поля к записи: убирает параметры чужих расписаний и переносит начало на сегодня,
 * если расписание новое или изменилось. Так правка действует только вперёд, прошлые отметки не трогаются.
 */
export function prepareRitual(prev: Ritual | null, draft: RitualFields, today: GameDate): RitualFields {
  const clean: RitualFields = {
    ...draft,
    title: draft.title.trim(),
    realName: draft.realName?.trim() || null,
    weekdaysMask: draft.schedule === "weekdays" ? draft.weekdaysMask : null,
    timesPerWeek: draft.schedule === "times_per_week" ? draft.timesPerWeek : null,
    intervalDays: draft.schedule === "every_n_days" ? draft.intervalDays : null,
  };
  const startDate = prev !== null && sameSchedule(ritualFieldsOf(prev), clean) ? prev.startDate : today;
  return { ...clean, startDate };
}

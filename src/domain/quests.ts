import { addDays, gameDateOfIso } from "./time";
import type { GameDate, Quest } from "./types";

export function isOverdue(q: Quest, today: GameDate): boolean {
  return q.status === "active" && q.dueDate !== null && q.dueDate < today;
}

export function completedOn(q: Quest, dayStartHour: number): GameDate | null {
  return q.completedAt ? gameDateOfIso(q.completedAt, dayStartHour) : null;
}

/** На сегодня: всё взятое на сегодня или раньше, всё с дедлайном до сегодня включительно. */
export function isForToday(q: Quest, today: GameDate): boolean {
  if (q.status !== "active") {
    return false;
  }
  const scheduled = q.scheduledDate !== null && q.scheduledDate <= today;
  const due = q.dueDate !== null && q.dueDate <= today;
  return scheduled || due;
}

function rank(q: Quest, today: GameDate): number {
  if (isOverdue(q, today)) {
    return 0;
  }
  return q.type === "main" ? 1 : 2;
}

export function byPriority(today: GameDate) {
  return (a: Quest, b: Quest): number =>
    rank(a, today) - rank(b, today) || a.sortOrder - b.sortOrder || a.id - b.id;
}

export interface TodayBoard {
  active: Quest[];
  done: Quest[];
}

export function todayBoard(quests: readonly Quest[], today: GameDate, dayStartHour: number): TodayBoard {
  return {
    active: quests.filter((q) => isForToday(q, today)).sort(byPriority(today)),
    done: quests.filter((q) => completedOn(q, dayStartHour) === today),
  };
}

export interface QuestColumns {
  today: Quest[];
  upcoming: Quest[];
  backlog: Quest[];
  archive: Quest[];
}

export function questColumns(quests: readonly Quest[], today: GameDate, dayStartHour: number): QuestColumns {
  const archiveFrom = addDays(today, -30);
  const active = quests.filter((q) => q.status === "active");
  const sort = byPriority(today);
  return {
    today: active.filter((q) => isForToday(q, today)).sort(sort),
    upcoming: active
      .filter((q) => !isForToday(q, today) && q.scheduledDate !== null)
      .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "") || sort(a, b)),
    backlog: active.filter((q) => !isForToday(q, today) && q.scheduledDate === null).sort(sort),
    archive: quests
      .filter((q) => {
        const done = completedOn(q, dayStartHour);
        return done !== null && done >= archiveFrom;
      })
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
  };
}

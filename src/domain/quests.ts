import { addDays, gameDateOfIso } from "./time";
import type { GameDate, Quest, QuestFields } from "./types";

export function isOverdue(q: Quest, today: GameDate): boolean {
  return q.status === "active" && q.dueDate !== null && q.dueDate < today;
}

export function completedOn(q: Quest, dayStartHour: number): GameDate | null {
  return q.completedAt ? gameDateOfIso(q.completedAt, dayStartHour) : null;
}

/** Задачи дня: Main и Side. Боссы живут в своей карточке, этапы внутри босса. */
export function isTask(q: Quest): boolean {
  return q.type === "main" || q.type === "side";
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
  return q.type === "boss" ? 1 : q.type === "main" ? 2 : 3;
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
    active: quests.filter((q) => isTask(q) && isForToday(q, today)).sort(byPriority(today)),
    done: quests.filter((q) => isTask(q) && completedOn(q, dayStartHour) === today),
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
  const active = quests.filter((q) => q.status === "active" && q.type !== "stage");
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

/** Редактируемые поля квеста: передаются в update целиком. */
export function fieldsOf(q: Quest): QuestFields {
  return {
    type: q.type,
    title: q.title,
    description: q.description,
    attribute: q.attribute,
    difficulty: q.difficulty,
    scheduledDate: q.scheduledDate,
    dueDate: q.dueDate,
    sortOrder: q.sortOrder,
    parentId: q.parentId,
    damage: q.damage,
  };
}

/** Новый порядок после перетаскивания: id переставляемого встаёт на место целевого. */
export function reorder<T extends { id: number }>(items: readonly T[], movedId: number, targetId: number): T[] {
  const moved = items.find((i) => i.id === movedId);
  if (!moved || movedId === targetId) return [...items];
  const rest = items.filter((i) => i.id !== movedId);
  const at = rest.findIndex((i) => i.id === targetId);
  return at < 0 ? [...rest, moved] : [...rest.slice(0, at), moved, ...rest.slice(at)];
}

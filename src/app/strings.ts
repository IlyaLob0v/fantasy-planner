import { plural } from "@/domain/plural";
import type { Attribute, QuestType, RitualSchedule } from "@/domain/types";

export { plural };

export const ATTRIBUTE_LABEL: Record<Attribute, string> = {
  strength: "Сила",
  intellect: "Интеллект",
  agility: "Ловкость",
};

export const ATTRIBUTE_HINT: Record<Attribute, string> = {
  strength: "Тело: спорт, здоровье, физический труд",
  intellect: "Ум: работа, учёба, чтение",
  agility: "Быт и навыки: дом, поручения, ручные хобби",
};

export const QUEST_TYPE_LABEL: Record<QuestType, string> = {
  main: "Главный квест",
  side: "Побочный квест",
};

export const QUEST_TYPE_SHORT: Record<QuestType, string> = {
  main: "Main",
  side: "Side",
};

export const DIFFICULTY_LABEL = ["", "Лёгкий", "Серьёзный", "Тяжёлый"] as const;

export function daysWord(n: number): string {
  return plural(n, "день", "дня", "дней");
}

export const SCHEDULE_LABEL: Record<RitualSchedule, string> = {
  daily: "Каждый день",
  weekdays: "По дням",
  times_per_week: "N раз в неделю",
  every_n_days: "Раз в N дней",
};

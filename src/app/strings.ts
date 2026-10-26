import type { Attribute, QuestType } from "@/domain/types";

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

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function daysWord(n: number): string {
  return plural(n, "день", "дня", "дней");
}

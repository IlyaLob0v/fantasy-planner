import type { InventoryItem, NewInventoryItem, Quest, Rarity } from "./types";

/** Этапы босса по порядку, без архивных. */
export function stagesOf(quests: readonly Quest[], bossId: number): Quest[] {
  return quests
    .filter((q) => q.type === "stage" && q.parentId === bossId && q.archivedAt === null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

export interface BossHp {
  current: number;
  max: number;
}

/** HP = сумма урона этапов; выполненные этапы его уже сняли. */
export function bossHp(stages: readonly Quest[]): BossHp {
  return {
    max: stages.reduce((sum, s) => sum + s.damage, 0),
    current: stages.filter((s) => s.status === "active").reduce((sum, s) => sum + s.damage, 0),
  };
}

export function nextStage(stages: readonly Quest[]): Quest | null {
  return stages.find((s) => s.status === "active") ?? null;
}

/** Боссы, с которыми ещё идёт бой: сначала ближайший дедлайн, затем старшие. */
export function activeBosses(quests: readonly Quest[]): Quest[] {
  return quests
    .filter((q) => q.type === "boss" && q.status === "active" && q.archivedAt === null)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.id - b.id);
}

/** Редкость трофея растёт с суммарным уроном: чем крупнее проект, тем ценнее добыча. */
export function lootRarity(totalDamage: number): Rarity {
  if (totalDamage >= 25) return "legendary";
  if (totalDamage >= 13) return "epic";
  if (totalDamage >= 6) return "rare";
  return "common";
}

const TROPHY: Record<Rarity, string> = {
  common: "Потёртый жетон",
  rare: "Серебряная печать",
  epic: "Знамя поверженного",
  legendary: "Корона чудовища",
};

export function lootFor(boss: Quest, stages: readonly Quest[]): NewInventoryItem {
  const rarity = lootRarity(bossHp(stages).max);
  return {
    itemType: "loot",
    itemName: `${TROPHY[rarity]}: ${boss.title}`,
    rarity,
    assetKey: null,
    sourceType: "boss",
    sourceId: boss.id,
  };
}

export function lootOf(inventory: readonly InventoryItem[], bossId: number): InventoryItem[] {
  return inventory.filter((i) => i.itemType === "loot" && i.sourceType === "boss" && i.sourceId === bossId);
}

const RARITY_ORDER: Record<Rarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };

/** Трофеи для сундука: сначала самые редкие, внутри редкости свежие. */
export function trophies(inventory: readonly InventoryItem[]): InventoryItem[] {
  return inventory
    .filter((i) => i.itemType === "loot")
    .sort((a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || b.obtainedAt.localeCompare(a.obtainedAt));
}

import type { Day, GameDate, InventoryItem, RealReward } from "./types";

/** Разовая награда исчезает из лавки после покупки; многоразовая остаётся. */
export function isOnSale(reward: RealReward, inventory: readonly InventoryItem[]): boolean {
  return reward.repeatable || !inventory.some((i) => i.sourceType === "purchase" && i.sourceId === reward.id && i.itemType === "reward");
}

export function unusedRewards(inventory: readonly InventoryItem[]): InventoryItem[] {
  return inventory.filter((i) => i.itemType === "reward" && i.redeemedAt === null);
}

export function usedRewards(inventory: readonly InventoryItem[]): InventoryItem[] {
  return inventory.filter((i) => i.itemType === "reward" && i.redeemedAt !== null);
}

/** Купленные дни отдыха с сегодняшнего дня и дальше, по порядку. */
export function restDaysAhead(days: readonly Day[], today: GameDate): GameDate[] {
  return days
    .filter((d) => d.kind === "rest" && d.gameDate >= today)
    .map((d) => d.gameDate)
    .sort();
}

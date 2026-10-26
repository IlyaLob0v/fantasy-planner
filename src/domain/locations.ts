import type { Character, InventoryItem, Location } from "./types";

export type LocationState = "home" | "owned" | "available" | "locked";

export function ownsLocation(location: Location, inventory: readonly InventoryItem[]): boolean {
  return location.price === 0 || inventory.some((i) => i.itemType === "location" && i.assetKey === location.assetKey);
}

/** Уровень даёт право, золото открывает. Дом всегда свой. */
export function locationState(location: Location, character: Character, inventory: readonly InventoryItem[]): LocationState {
  if (location.key === character.locationKey) return "home";
  if (ownsLocation(location, inventory)) return "owned";
  return character.level >= location.unlockLevel ? "available" : "locked";
}

/** Локации, доступ к которым открылся при переходе с уровня before на after. */
export function unlockedBetween(locations: readonly Location[], before: number, after: number): Location[] {
  return locations.filter((l) => l.unlockLevel > before && l.unlockLevel <= after && l.price > 0);
}

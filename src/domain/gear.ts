import type { EquipmentSlot, GameDate, Gear, GearSlot, GearSource, NewGear, Rarity, Settings } from "./types";

/**
 * Способности снаряжения: удобства вместо множителей наград (решение В4).
 * Работают, только пока предмет надет; одинаковые способности не складываются.
 */
export const PERKS = ["wind_guard", "rest_discount", "forge_discount", "lantern", "spyglass", "clear_mind"] as const;
export type Perk = (typeof PERKS)[number];

export const PERK_TEXT: Record<Perk, string> = {
  wind_guard: "Одиночный пропуск не опускает Попутный ветер",
  rest_discount: "День отдыха на 25 % дешевле",
  forge_discount: "Кузнец берёт на 20 % меньше",
  lantern: "Привал выбирается из списка, а не случайно",
  spyglass: "Доска квестов видит две недели вперёд",
  clear_mind: "Усталость не приглушает свет, остаётся только статус",
};

export interface GearDef {
  key: string;
  slot: GearSlot;
  name: string;
  rarity: Rarity;
  perk: Perk | null;
  /** Реликвия: только за веху Зала славы, не выпадает и не продаётся. */
  relicOf: string | null;
}

function item(slot: GearSlot, key: string, name: string, rarity: Rarity, perk: Perk | null = null): GearDef {
  return { key, slot, name, rarity, perk, relicOf: null };
}

function relic(slot: GearSlot, key: string, name: string, achievement: string): GearDef {
  return { key, slot, name, rarity: "legendary", perk: null, relicOf: achievement };
}

/** Каталог снаряжения. Ключи стабильны: по ним хранится владение. */
export const GEAR: readonly GearDef[] = [
  item("weapon", "wanderer_dagger", "Кинжал странника", "common"),
  item("weapon", "oak_staff", "Дубовый посох", "common"),
  item("weapon", "militia_spear", "Копьё ополченца", "common"),
  item("weapon", "gate_sword", "Меч надвратной стражи", "rare"),
  item("weapon", "hunter_bow", "Лук соснового бора", "rare"),
  item("weapon", "ember_axe", "Топор тлеющего угля", "epic"),
  item("weapon", "moon_blade", "Лунный клинок", "epic"),
  item("weapon", "dawn_glaive", "Глефа первого рассвета", "legendary"),

  item("helm", "leather_cap", "Кожаный шлем", "common"),
  item("helm", "iron_helm", "Железный шлем", "common"),
  item("helm", "scholar_hood", "Капюшон книжника", "common"),
  item("helm", "watch_helm", "Шлем дозорного", "rare", "spyglass"),
  item("helm", "tavern_hat", "Шляпа завсегдатая таверны", "rare"),
  item("helm", "winged_helm", "Крылатый шлем", "rare"),
  item("helm", "clear_morning_circlet", "Венец ясного утра", "epic", "clear_mind"),
  item("helm", "owl_mask", "Маска ночной совы", "epic"),

  item("armor", "padded_jacket", "Стёганка", "common"),
  item("armor", "chain_shirt", "Кольчужная рубаха", "common"),
  item("armor", "traveler_coat", "Дорожный кафтан", "common"),
  item("armor", "smith_leathers", "Кожаный доспех кузнеца", "rare", "forge_discount"),
  item("armor", "scale_mail", "Чешуйчатая броня", "rare"),
  item("armor", "citadel_plate", "Латы цитадели", "epic"),
  item("armor", "goblin_brigandine", "Бригантина с гоблинского рынка", "epic"),
  item("armor", "starsteel_plate", "Латы из звёздной стали", "legendary"),

  item("cloak", "wool_cloak", "Шерстяной плащ", "common"),
  item("cloak", "hooded_mantle", "Плащ с капюшоном", "common"),
  item("cloak", "pine_cloak", "Плащ соснового бора", "common"),
  item("cloak", "wanderer_cloak", "Плащ странника", "rare", "wind_guard"),
  item("cloak", "crimson_cape", "Бордовый плащ гонца", "rare"),
  item("cloak", "fur_mantle", "Меховая накидка", "rare"),
  item("cloak", "north_wind_cloak", "Плащ северного ветра", "epic", "wind_guard"),
  item("cloak", "dragonwing_cloak", "Плащ из драконьего крыла", "legendary"),

  item("talisman", "river_pebble", "Речной камешек", "common"),
  item("talisman", "copper_ring", "Медное кольцо", "common"),
  item("talisman", "rowan_charm", "Рябиновый оберег", "common"),
  item("talisman", "ember_talisman", "Талисман тлеющего угля", "rare", "rest_discount"),
  item("talisman", "silver_key", "Серебряный ключ", "rare"),
  item("talisman", "wayfarer_lantern", "Фонарь путника", "epic", "lantern"),
  item("talisman", "seer_eye", "Око прорицателя", "epic"),
  item("talisman", "hearth_heart", "Сердце очага", "legendary", "rest_discount"),

  relic("cloak", "dawn_cloak", "Плащ неугасимой зари", "streak_30"),
  relic("helm", "hundred_dawns_crown", "Корона ста рассветов", "streak_100"),
  relic("weapon", "giant_hunter_blade", "Клинок охотника на великанов", "bosses_15"),
  relic("armor", "magister_plate", "Доспех магистра", "level_20"),
  relic("talisman", "scale_amulet", "Чешуйчатый амулет", "boss_legendary"),
];

export const RARITIES: readonly Rarity[] = ["common", "rare", "epic", "legendary"];

export function gearByKey(key: string): GearDef | undefined {
  return GEAR.find((g) => g.key === key);
}

export function relicFor(achievement: string): GearDef | undefined {
  return GEAR.find((g) => g.relicOf === achievement);
}

/** Детерминированное число в [0, 1) из строки (FNV-1a): тот же день и то же дело дают тот же бросок. */
export function roll(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 0x100000000;
}

export function unlockedRarities(level: number, loot: Settings["loot"]): Rarity[] {
  return RARITIES.filter((r) => level >= loot.unlockLevel[r]);
}

/** Чего ещё нет у героя из того, что может выпасть: без реликвий и без дублей. */
export function dropPool(owned: readonly Gear[], rarities: readonly Rarity[]): GearDef[] {
  const have = new Set(owned.map((g) => g.itemKey));
  return GEAR.filter((g) => g.relicOf === null && !have.has(g.key) && rarities.includes(g.rarity));
}

/** Шанс находки в процентах после `misses` дел без неё; на пороге гарантия. */
export function findChance(misses: number, loot: Settings["loot"]): number {
  if (misses + 1 >= loot.pity) return 100;
  return Math.min(100, loot.basePct + loot.stepPct * misses);
}

function pickRarity(pool: readonly GearDef[], weights: Record<Rarity, number>, r: number): Rarity | null {
  const present = RARITIES.filter((rarity) => pool.some((g) => g.rarity === rarity) && weights[rarity] > 0);
  const total = present.reduce((sum, rarity) => sum + weights[rarity], 0);
  let cursor = r * total;
  for (const rarity of present) {
    cursor -= weights[rarity];
    if (cursor < 0) return rarity;
  }
  return present.at(-1) ?? null;
}

function pickFrom(list: readonly GearDef[], r: number): GearDef | null {
  return list[Math.floor(r * list.length)] ?? null;
}

export interface FindRoll {
  /** Что выпало, или null. */
  found: GearDef | null;
  /** Счётчик невезения после броска. */
  misses: number;
}

/**
 * Бросок находки за одно дело. Ничего не бросается (и счётчик не растёт), если сегодня уже
 * упёрлись в потолок находок или собрано всё доступное по уровню.
 */
export function rollFind(seed: string, level: number, misses: number, owned: readonly Gear[], today: GameDate, loot: Settings["loot"]): FindRoll {
  const todayFinds = owned.filter((g) => g.gameDate === today && (g.sourceType === "quest" || g.sourceType === "ritual")).length;
  const pool = dropPool(owned, unlockedRarities(level, loot));
  if (todayFinds >= loot.dailyCap || pool.length === 0) {
    return { found: null, misses };
  }
  if (roll(`${seed}:find`) * 100 >= findChance(misses, loot)) {
    return { found: null, misses: misses + 1 };
  }
  const rarity = pickRarity(pool, loot.weights, roll(`${seed}:rarity`));
  const found = pickFrom(
    pool.filter((g) => g.rarity === rarity),
    roll(`${seed}:item`),
  );
  return { found, misses: found ? 0 : misses + 1 };
}

/** Трофей за победу над боссом: гарантированный предмет, редкость по HP, но не выше открытой уровнем. */
export function bossFind(seed: string, hpRarity: Rarity, level: number, owned: readonly Gear[], loot: Settings["loot"]): GearDef | null {
  const open = unlockedRarities(level, loot);
  const cap = RARITIES.indexOf(hpRarity);
  const tiers = open.filter((r) => RARITIES.indexOf(r) <= cap).reverse();
  for (const rarity of tiers) {
    const pool = dropPool(owned, [rarity]);
    const found = pickFrom(pool, roll(`${seed}:boss`));
    if (found) return found;
  }
  return null;
}

export function newGear(def: GearDef, source: GearSource, sourceId: number | null, gameDate: GameDate, missesBefore: number, uid: string): NewGear {
  return { uid, itemKey: def.key, sourceType: source, sourceId, gameDate, missesBefore };
}

/** Способности надетых предметов. */
export function activePerks(gear: readonly Gear[], equipment: readonly EquipmentSlot[]): Set<Perk> {
  const perks = new Set<Perk>();
  for (const slot of equipment) {
    const owned = gear.find((g) => g.id === slot.gearId);
    const perk = owned ? gearByKey(owned.itemKey)?.perk : null;
    if (perk) perks.add(perk);
  }
  return perks;
}

export function restPrice(base: number, perks: ReadonlySet<Perk>): number {
  return perks.has("rest_discount") ? Math.round(base * 0.75) : base;
}

/** Кузнец продаёт конкретные обычные и редкие предметы по фиксированной цене. */
export function forgePrice(def: GearDef, prices: Settings["forgePrices"], perks: ReadonlySet<Perk>): number | null {
  const base = def.rarity === "common" ? prices.common : def.rarity === "rare" ? prices.rare : null;
  if (base === null || def.relicOf !== null) return null;
  return perks.has("forge_discount") ? Math.round(base * 0.8) : base;
}

export function forgeStock(owned: readonly Gear[], level: number, loot: Settings["loot"]): GearDef[] {
  return dropPool(owned, unlockedRarities(level, loot).filter((r) => r === "common" || r === "rare"));
}

/** Лучшая редкость надетого: от неё рамка портрета. */
export function bestEquipped(gear: readonly Gear[], equipment: readonly EquipmentSlot[]): Rarity | null {
  let best: Rarity | null = null;
  for (const slot of equipment) {
    const def = gearByKey(gear.find((g) => g.id === slot.gearId)?.itemKey ?? "");
    if (def && (best === null || RARITIES.indexOf(def.rarity) > RARITIES.indexOf(best))) best = def.rarity;
  }
  return best;
}

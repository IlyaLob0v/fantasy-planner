import { isRecord, readNumber, readRecord, type JsonRecord } from "./guards";
import type { Rarity, Rate, Settings } from "./types";

function rarities(source: JsonRecord, key: string): Record<Rarity, number> {
  const raw = readRecord(source, key);
  return {
    common: readNumber(raw, "common"),
    rare: readNumber(raw, "rare"),
    epic: readNumber(raw, "epic"),
    legendary: readNumber(raw, "legendary"),
  };
}

function readText(source: JsonRecord, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function rate(source: JsonRecord, key: string): Rate {
  const raw = readRecord(source, key);
  return { xp: readNumber(raw, "xp"), gold: readNumber(raw, "gold") };
}

/** Разбирает сырые настройки из SQLite в типизированный вид. Ошибка формата бросается сразу. */
export function parseSettings(raw: unknown): Settings {
  if (!isRecord(raw)) {
    throw new Error("Настройки не прочитаны");
  }
  const rates = readRecord(raw, "rates");
  const streak = readRecord(raw, "streak_bonus");
  const curve = readRecord(raw, "level_curve");
  const loot = readRecord(raw, "loot");
  const forge = readRecord(raw, "forge_prices");
  const week = readRecord(raw, "week");
  const crest = readRecord(raw, "crest");
  return {
    dayStartHour: readNumber(raw, "day_start_hour"),
    rates: {
      side: rate(rates, "side"),
      main: rate(rates, "main"),
      stage: rate(rates, "stage"),
      bossDefeat: rate(rates, "boss_defeat"),
      ritual: rate(rates, "ritual"),
      restAction: rate(rates, "rest_action"),
    },
    restPrice: readNumber(raw, "rest_price"),
    streakBonus: {
      stepDays: readNumber(streak, "step_days"),
      stepPct: readNumber(streak, "step_pct"),
      maxPct: readNumber(streak, "max_pct"),
    },
    levelCurve: {
      base: readNumber(curve, "base"),
      exp: readNumber(curve, "exp"),
      round: readNumber(curve, "round"),
    },
    motion: raw["motion"] === "reduced" ? "reduced" : "full",
    oathDone: raw["oath_done"] === true,
    starterPack: raw["starter_pack"] === true,
    loot: {
      basePct: readNumber(loot, "base_pct"),
      stepPct: readNumber(loot, "step_pct"),
      pity: readNumber(loot, "pity"),
      dailyCap: readNumber(loot, "daily_cap"),
      weights: rarities(loot, "weights"),
      unlockLevel: rarities(loot, "unlock_level"),
    },
    forgePrices: { common: readNumber(forge, "common"), rare: readNumber(forge, "rare") },
    week: { goalGold: readNumber(week, "goal_gold"), chestGold: readNumber(week, "chest_gold"), stretchPct: readNumber(week, "stretch_pct") },
    recapSeen: typeof raw["recap_seen"] === "string" ? raw["recap_seen"] : "",
    crest: { shield: readText(crest, "shield"), charge: readText(crest, "charge"), tincture: readText(crest, "tincture") },
    crestPrice: readNumber(raw, "crest_price"),
    hintsSeen: Array.isArray(raw["hints_seen"]) ? raw["hints_seen"].filter((k): k is string => typeof k === "string") : [],
  };
}

/** Записывает правленые ставки поверх сырых, не теряя ключей, которых экран не знает. */
export function mergeRates(rawSettings: unknown, rates: Settings["rates"]): JsonRecord {
  const current = isRecord(rawSettings) ? readRecord(rawSettings, "rates") : {};
  return {
    ...current,
    side: { ...rates.side },
    main: { ...rates.main },
    stage: { ...rates.stage },
    boss_defeat: { ...rates.bossDefeat },
    ritual: { ...rates.ritual },
    rest_action: { ...rates.restAction },
  };
}

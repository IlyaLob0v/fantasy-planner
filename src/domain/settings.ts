import { isRecord, readNumber, readRecord, type JsonRecord } from "./guards";
import type { Rate, Settings } from "./types";

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
  return {
    dayStartHour: readNumber(raw, "day_start_hour"),
    rates: { side: rate(rates, "side"), main: rate(rates, "main"), restAction: rate(rates, "rest_action") },
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
  };
}

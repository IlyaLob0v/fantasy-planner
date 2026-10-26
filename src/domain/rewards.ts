import type { Quest, Reward, Settings } from "./types";

/** Бонус «Попутный ветер» в процентах для текущей ступени. */
export function windBonusPct(windStep: number, bonus: Settings["streakBonus"]): number {
  return Math.min(windStep * bonus.stepPct, bonus.maxPct);
}

export function maxWindStep(bonus: Settings["streakBonus"]): number {
  return Math.floor(bonus.maxPct / bonus.stepPct);
}

/** Награда = ставка типа × сложность; золото дополнительно × (1 + бонус серии). */
export function questReward(
  quest: Pick<Quest, "type" | "difficulty" | "attribute">,
  settings: Settings,
  windStep: number,
): Reward {
  const rate = settings.rates[quest.type];
  const bonus = windBonusPct(windStep, settings.streakBonus);
  return {
    xp: rate.xp * quest.difficulty,
    gold: Math.round(rate.gold * quest.difficulty * (1 + bonus / 100)),
    attribute: quest.attribute,
    attributeDelta: quest.difficulty,
  };
}

export function restActionReward(settings: Settings): Reward {
  return { xp: settings.rates.restAction.xp, gold: settings.rates.restAction.gold, attribute: null, attributeDelta: 0 };
}

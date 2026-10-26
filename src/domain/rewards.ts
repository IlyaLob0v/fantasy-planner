import type { Quest, Reward, Ritual, Settings } from "./types";

/** Бонус «Попутный ветер» в процентах для текущей ступени. */
export function windBonusPct(windStep: number, bonus: Settings["streakBonus"]): number {
  return Math.min(windStep * bonus.stepPct, bonus.maxPct);
}

export function maxWindStep(bonus: Settings["streakBonus"]): number {
  return Math.floor(bonus.maxPct / bonus.stepPct);
}

function scaled(rate: Settings["rates"]["side"], deed: Pick<Quest, "difficulty" | "attribute">, settings: Settings, windStep: number): Reward {
  const bonus = windBonusPct(windStep, settings.streakBonus);
  return {
    xp: rate.xp * deed.difficulty,
    gold: Math.round(rate.gold * deed.difficulty * (1 + bonus / 100)),
    attribute: deed.attribute,
    attributeDelta: deed.difficulty,
  };
}

/** Награда = ставка типа × сложность; золото дополнительно × (1 + бонус серии). */
export function questReward(
  quest: Pick<Quest, "type" | "difficulty" | "attribute">,
  settings: Settings,
  windStep: number,
): Reward {
  return scaled(settings.rates[quest.type], quest, settings, windStep);
}

export function ritualReward(ritual: Pick<Ritual, "difficulty" | "attribute">, settings: Settings, windStep: number): Reward {
  return scaled(settings.rates.ritual, ritual, settings, windStep);
}

export function restActionReward(settings: Settings): Reward {
  return { xp: settings.rates.restAction.xp, gold: settings.rates.restAction.gold, attribute: null, attributeDelta: 0 };
}

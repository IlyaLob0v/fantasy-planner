import type { Quest, QuestType, Reward, Ritual, Settings } from "./types";

/** Бонус «Попутный ветер» в процентах для текущей ступени. */
export function windBonusPct(windStep: number, bonus: Settings["streakBonus"]): number {
  return Math.min(windStep * bonus.stepPct, bonus.maxPct);
}

export function maxWindStep(bonus: Settings["streakBonus"]): number {
  return Math.floor(bonus.maxPct / bonus.stepPct);
}

function scaled(
  rate: Settings["rates"]["side"],
  deed: Pick<Quest, "difficulty" | "attribute">,
  settings: Settings,
  windStep: number,
  stepsPct = 0,
): Reward {
  const bonus = windBonusPct(windStep, settings.streakBonus);
  const steps = 1 + stepsPct / 100;
  return {
    xp: Math.round(rate.xp * deed.difficulty * steps),
    gold: Math.round(rate.gold * deed.difficulty * (1 + bonus / 100) * steps),
    attribute: deed.attribute,
    attributeDelta: deed.difficulty,
  };
}

const RATE_OF: Record<QuestType, keyof Settings["rates"]> = {
  main: "main",
  side: "side",
  stage: "stage",
  boss: "bossDefeat",
};

/**
 * Награда = ставка типа × сложность; золото дополнительно × (1 + бонус серии).
 * Отмеченные пункты чек-листа добавляют к опыту и золоту свой бонус (`stepsDone`).
 * Для босса это награда за победу, она добавляется к награде за последний этап.
 */
export function questReward(
  quest: Pick<Quest, "type" | "difficulty" | "attribute">,
  settings: Settings,
  windStep: number,
  stepsDone = 0,
): Reward {
  return scaled(settings.rates[RATE_OF[quest.type]], quest, settings, windStep, stepsBonusPct(stepsDone));
}

/** Пунктов чек-листа на одну ступень бонуса, шаг и потолок бонуса в процентах. */
export const STEPS_PER_BONUS = 3;
export const STEPS_BONUS_PCT = 10;
export const STEPS_BONUS_MAX_PCT = 30;

/** Бонус чек-листа: +10 % за каждые 3 отмеченных пункта, не больше +30 %. */
export function stepsBonusPct(stepsDone: number): number {
  return Math.min(STEPS_BONUS_MAX_PCT, Math.floor(stepsDone / STEPS_PER_BONUS) * STEPS_BONUS_PCT);
}

export function ritualReward(ritual: Pick<Ritual, "difficulty" | "attribute">, settings: Settings, windStep: number): Reward {
  return scaled(settings.rates.ritual, ritual, settings, windStep);
}

export function restActionReward(settings: Settings): Reward {
  return { xp: settings.rates.restAction.xp, gold: settings.rates.restAction.gold, attribute: null, attributeDelta: 0 };
}

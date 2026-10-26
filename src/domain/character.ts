import { levelProgress, titleForLevel } from "./levels";
import type { Attribute, Character, CharacterState, Reward, Settings } from "./types";

export function stateOf(c: Character): CharacterState {
  return {
    title: c.title,
    level: c.level,
    xp: c.xp,
    gold: c.gold,
    strength: c.strength,
    intellect: c.intellect,
    agility: c.agility,
    streakCurrent: c.streakCurrent,
    streakBest: c.streakBest,
    windStep: c.windStep,
    fatiguedSince: c.fatiguedSince,
  };
}

function bump(state: CharacterState, attribute: Attribute | null, delta: number): CharacterState {
  switch (attribute) {
    case "strength":
      return { ...state, strength: Math.max(0, state.strength + delta) };
    case "intellect":
      return { ...state, intellect: Math.max(0, state.intellect + delta) };
    case "agility":
      return { ...state, agility: Math.max(0, state.agility + delta) };
    case null:
      return state;
  }
}

/** Применяет награду (или её отмену, если sign = -1) и пересчитывает уровень и титул. */
export function applyReward(
  state: CharacterState,
  reward: Reward,
  sign: 1 | -1,
  curve: Settings["levelCurve"],
): CharacterState {
  const xp = Math.max(0, state.xp + sign * reward.xp);
  const gold = state.gold + sign * reward.gold;
  if (gold < 0) {
    throw new Error("В сундуке не хватает золота");
  }
  const { level } = levelProgress(xp, curve);
  const withAttr = bump({ ...state, xp, gold, level }, reward.attribute, sign * reward.attributeDelta);
  return { ...withAttr, title: titleForLevel(level) };
}

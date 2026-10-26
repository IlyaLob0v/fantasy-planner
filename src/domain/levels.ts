import type { Settings } from "./types";

type Curve = Settings["levelCurve"];

/** XP, нужный чтобы перейти с уровня `level` на следующий. */
export function xpToNext(level: number, curve: Curve): number {
  const raw = curve.base * Math.pow(level, curve.exp);
  return Math.max(curve.round, Math.round(raw / curve.round) * curve.round);
}

export interface LevelProgress {
  level: number;
  into: number;
  needed: number;
}

export function levelProgress(totalXp: number, curve: Curve): LevelProgress {
  let level = 1;
  let floor = 0;
  for (;;) {
    const needed = xpToNext(level, curve);
    if (totalXp < floor + needed) {
      return { level, into: totalXp - floor, needed };
    }
    floor += needed;
    level += 1;
  }
}

const TITLES: ReadonlyArray<readonly [number, string]> = [
  [30, "Владыка замка"],
  [20, "Магистр гильдии"],
  [16, "Капитан гильдии"],
  [12, "Хранитель цитадели"],
  [8, "Рыцарь башни"],
  [5, "Страж ворот"],
  [3, "Оруженосец"],
  [1, "Странник"],
];

export function titleForLevel(level: number): string {
  const match = TITLES.find(([from]) => level >= from);
  return match ? match[1] : "Странник";
}

import type { Character, Day, Quest, Settings } from "./types";

export const settings: Settings = {
  dayStartHour: 4,
  rates: { side: { xp: 10, gold: 3 }, main: { xp: 30, gold: 10 }, restAction: { xp: 3, gold: 0 } },
  streakBonus: { stepDays: 7, stepPct: 10, maxPct: 30 },
  levelCurve: { base: 50, exp: 1.4, round: 5 },
  motion: "full",
};

export function character(overrides: Partial<Character> = {}): Character {
  return {
    name: "Странник",
    title: "Странник",
    level: 1,
    xp: 0,
    gold: 0,
    strength: 0,
    intellect: 0,
    agility: 0,
    streakCurrent: 0,
    streakBest: 0,
    windStep: 0,
    fatiguedSince: null,
    locationKey: "gatehouse",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

export function quest(overrides: Partial<Quest> = {}): Quest {
  return {
    id: 1,
    parentId: null,
    type: "side",
    title: "Наточить меч",
    description: null,
    attribute: "strength",
    difficulty: 1,
    status: "active",
    scheduledDate: "2026-10-26",
    dueDate: null,
    damage: 1,
    sortOrder: 0,
    createdAt: "2026-10-26T08:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

export function day(gameDate: string, deedsCount: number, closed = true): Day {
  return { gameDate, kind: "normal", deedsCount, closedAt: closed ? "2026-10-27T00:00:00.000Z" : null };
}

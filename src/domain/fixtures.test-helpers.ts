import type { Character, Day, Quest, RealReward, Ritual, Settings } from "./types";

export const settings: Settings = {
  dayStartHour: 4,
  rates: {
    side: { xp: 10, gold: 3 },
    main: { xp: 30, gold: 10 },
    stage: { xp: 15, gold: 4 },
    bossDefeat: { xp: 60, gold: 25 },
    ritual: { xp: 5, gold: 2 },
    restAction: { xp: 3, gold: 0 },
  },
  restPrice: 40,
  streakBonus: { stepDays: 7, stepPct: 10, maxPct: 30 },
  levelCurve: { base: 50, exp: 1.4, round: 5 },
  motion: "full",
  oathDone: false,
  hintsSeen: [],
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

export function ritual(overrides: Partial<Ritual> = {}): Ritual {
  return {
    id: 1,
    title: "Утренняя молитва",
    realName: "зарядка",
    attribute: "strength",
    schedule: "daily",
    weekdaysMask: null,
    timesPerWeek: null,
    intervalDays: null,
    startDate: "2026-10-01",
    pausedUntil: null,
    difficulty: 1,
    sortOrder: 0,
    createdAt: "2026-10-01T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

export function realReward(overrides: Partial<RealReward> = {}): RealReward {
  return {
    id: 1,
    title: "Вечер в таверне",
    description: "поход в кино",
    price: 50,
    repeatable: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    archivedAt: null,
    ...overrides,
  };
}

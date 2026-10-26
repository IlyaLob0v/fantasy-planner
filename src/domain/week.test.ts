import { describe, expect, it } from "vitest";

import { CREST_PARTS, planBuyCrestPart, resolveCrest } from "./crest";
import { character, day, quest, ritual, settings } from "./fixtures.test-helpers";
import { GEAR, type Perk } from "./gear";
import type { TurnContext } from "./turns";
import type { ChronicleEntry, LedgerEntry, WeekGoal } from "./types";
import {
  availableGoals,
  pickGoals,
  planNewWeek,
  planWeekGoals,
  recapWeek,
  suggestTarget,
  swapOptions,
  targetFor,
  weekFacts,
  weekRecap,
  type WeekFacts,
} from "./week";

const monday = "2026-10-26";
const wednesday = "2026-10-28";

function turn(overrides: Partial<TurnContext> = {}): TurnContext {
  let n = 0;
  return {
    character: character(),
    settings,
    days: [day(monday, 0, false)],
    today: monday,
    now: new Date("2026-10-26T12:00:00"),
    gear: [],
    perks: new Set<Perk>(),
    uid: () => `uid-${String((n += 1))}`,
    ...overrides,
  };
}

let nextId = 0;
function entry(overrides: Partial<LedgerEntry>): LedgerEntry {
  nextId += 1;
  return {
    id: nextId,
    occurredAt: "2026-10-26T10:00:00.000Z",
    gameDate: monday,
    sourceType: "quest",
    sourceId: 1,
    xpDelta: 10,
    goldDelta: 3,
    attribute: null,
    attributeDelta: 0,
    revertsId: null,
    note: null,
    ...overrides,
  };
}

function goal(overrides: Partial<WeekGoal>): WeekGoal {
  return { id: 1, weekStart: monday, goalKey: "deeds", target: 5, state: "active", completedAt: null, ...overrides };
}

const facts = (over: Partial<WeekFacts> = {}): WeekFacts => ({ deeds: 0, main: 0, rituals: 0, boss: 0, days: 0, chronicle: 0, ...over });

describe("неделя гильдии: факты", () => {
  it("считает дела, главные квесты, урон по боссам и дни, без отменённого", () => {
    const quests = [quest({ id: 1, type: "main" }), quest({ id: 2, type: "stage", damage: 4, parentId: 9 }), quest({ id: 3 })];
    const undone = entry({ sourceId: 3, gameDate: "2026-10-27" });
    const ledger = [
      entry({ sourceId: 1 }),
      entry({ sourceId: 2, gameDate: "2026-10-27" }),
      entry({ sourceType: "ritual", sourceId: 7, gameDate: "2026-10-27" }),
      undone,
      entry({ sourceType: "revert", sourceId: 3, revertsId: undone.id, gameDate: "2026-10-27" }),
      entry({ sourceType: "purchase", sourceId: null, goldDelta: -40 }),
      entry({ sourceId: 3, gameDate: "2026-10-19" }),
    ];
    const chronicle: ChronicleEntry[] = [
      { gameDate: monday, happened: "Сдал отчёт", noticed: "", feeling: "", mood: null, updatedAt: "" },
      { gameDate: "2026-10-27", happened: "", noticed: "", feeling: "", mood: null, updatedAt: "" },
    ];
    expect(weekFacts(ledger, quests, chronicle, monday)).toEqual({ deeds: 3, main: 1, rituals: 1, boss: 4, days: 2, chronicle: 1 });
  });

  it("цель чуть выше среднего, не ниже порога, дни не больше семи", () => {
    expect(suggestTarget("deeds", [], 10)).toBe(5);
    expect(suggestTarget("deeds", [facts({ deeds: 20 }), facts({ deeds: 30 })], 10)).toBe(28);
    expect(suggestTarget("days", [facts({ days: 7 })], 10)).toBe(7);
  });

  it("цель посреди недели засчитывает сделанное и просит долю на остаток", () => {
    const past = [facts({ deeds: 28 })];
    const at = (now: Partial<WeekFacts>, before: Partial<WeekFacts> = now) => ({ now: facts(now), beforeToday: facts(before) });
    expect(targetFor("deeds", past, at({}), monday, 0)).toBe(28);
    expect(targetFor("deeds", past, at({ deeds: 6 }), wednesday, 0)).toBe(6 + 20);
  });

  it("цель по дням не просит больше дней, чем осталось", () => {
    const daily = [facts({ days: 7 })];
    const at = (now: number, before: number) => ({ now: facts({ days: now }), beforeToday: facts({ days: before }) });
    expect(targetFor("days", daily, at(0, 0), monday, 0)).toBe(7);
    expect(targetFor("days", daily, at(1, 0), monday, 0)).toBe(7);
    expect(targetFor("days", daily, at(2, 1), wednesday, 0)).toBe(6);
    expect(targetFor("days", daily, at(3, 2), "2026-11-01", 0)).toBe(4);
  });
});

describe("неделя гильдии: выбор целей", () => {
  it("предлагает только то, что есть у героя, и «дела» всегда", () => {
    const quests = [quest({ id: 1, type: "boss" })];
    const keys = availableGoals(quests, [ritual()], []);
    expect(keys).toEqual(["deeds", "rituals", "boss", "days"]);
    const picked = pickGoals(monday, keys);
    expect(picked).toHaveLength(3);
    expect(picked[0]).toBe("deeds");
    expect(pickGoals(monday, keys)).toEqual(picked);
  });

  it("новая неделя: три цели с uid и порогами новичка", () => {
    const goals = planNewWeek(monday, ["deeds", "days"], [], { now: facts(), beforeToday: facts() }, 10, () => "u");
    expect(goals).toEqual([
      { uid: "u", weekStart: monday, goalKey: "deeds", target: 5 },
      { uid: "u", weekStart: monday, goalKey: "days", target: 3 },
    ]);
  });

  it("замена только на цель, которой ещё нет на неделе", () => {
    const goals = [goal({ goalKey: "deeds" }), goal({ id: 2, goalKey: "days", state: "off" })];
    expect(swapOptions(goals, ["deeds", "rituals", "days", "main"])).toEqual(["rituals", "main"]);
  });
});

describe("неделя гильдии: награды", () => {
  const goals = [goal({ id: 1, goalKey: "deeds", target: 5 }), goal({ id: 2, goalKey: "days", target: 3 }), goal({ id: 3, goalKey: "rituals", target: 4 })];

  it("закрывает набравшие цели с золотом, без сундука, пока не все", () => {
    const result = planWeekGoals(turn({ character: character({ gold: 10 }) }), goals, facts({ deeds: 5, days: 3, rituals: 1 }));
    expect(result?.outcome.weekGoalsDone).toEqual([1, 2]);
    expect(result?.outcome.ledger.map((e) => [e.sourceType, e.sourceId, e.goldDelta, e.note])).toEqual([
      ["week_chest", 1, 20, "goal:deeds"],
      ["week_chest", 2, 20, "goal:days"],
    ]);
    expect(result?.chest).toBe(false);
    expect(result?.outcome.character.gold).toBe(50);
    expect(planWeekGoals(turn(), goals, facts({ deeds: 4 }))).toBeNull();
  });

  it("последняя цель открывает сундук: золото и гарантированный предмет без дублей", () => {
    const done = goals.map((g) => (g.id === 3 ? g : { ...g, state: "done" as const }));
    const owned = GEAR.filter((g) => g.rarity === "common" && g.key !== "river_pebble").map((g, i) => ({
      id: i + 1,
      itemKey: g.key,
      sourceType: "forge" as const,
      sourceId: null,
      gameDate: "2026-10-01",
      missesBefore: 0,
      obtainedAt: "",
    }));
    const result = planWeekGoals(turn({ gear: owned }), done, facts({ rituals: 4 }));
    expect(result?.chest).toBe(true);
    expect(result?.gold).toBe(80);
    expect(result?.find?.key).toBe("river_pebble");
    expect(result?.outcome.gear).toEqual([
      { uid: "uid-1", itemKey: "river_pebble", sourceType: "week_chest", sourceId: null, gameDate: monday, missesBefore: 0 },
    ]);
  });

  it("выключенная цель сундука не даёт", () => {
    const withOff = [goal({ id: 1, state: "done" }), goal({ id: 2, goalKey: "days", state: "off" }), goal({ id: 3, goalKey: "rituals", target: 1 })];
    expect(planWeekGoals(turn(), withOff, facts({ rituals: 1 }))?.chest).toBe(false);
  });
});

describe("летопись недели", () => {
  it("итог прошлой недели: дела, лучший день, находки, достижения, строки хроники", () => {
    const last = "2026-10-19";
    const ledger = [
      entry({ gameDate: last }),
      entry({ gameDate: "2026-10-21" }),
      entry({ gameDate: "2026-10-21", sourceType: "ritual" }),
      entry({ gameDate: "2026-10-21", sourceType: "purchase", goldDelta: -40, xpDelta: 0 }),
      entry({ gameDate: monday }),
    ];
    const recap = weekRecap(last, {
      ledger,
      chronicle: [{ gameDate: "2026-10-20", happened: "  Нашёл старую карту ", noticed: "", feeling: "", mood: null, updatedAt: "" }],
      gear: [{ id: 1, itemKey: "oak_staff", sourceType: "quest", sourceId: 1, gameDate: "2026-10-21", missesBefore: 3, obtainedAt: "" }],
      achievements: [{ key: "first_quest", unlockedAt: "2026-10-19T09:00:00.000Z" }],
      goals: [goal({ weekStart: last, state: "done" }), goal({ id: 2, weekStart: last, goalKey: "days" })],
      dayStartHour: 4,
    });
    expect(recap).toMatchObject({
      deeds: 3,
      xp: 30,
      gold: 9,
      bestDay: { date: "2026-10-21", deeds: 2 },
      glory: ["first_quest"],
      goalsDone: 1,
      goalsTotal: 2,
      lines: ["Нашёл старую карту"],
    });
    expect(recap.finds.map((f) => f.key)).toEqual(["oak_staff"]);
  });

  it("показывается до закрытия", () => {
    expect(recapWeek(wednesday, "")).toBe("2026-10-19");
    expect(recapWeek(wednesday, "2026-10-19")).toBeNull();
  });
});

describe("герб гильдии", () => {
  it("рисует только то, что есть у гильдии", () => {
    expect(resolveCrest({ shield: "round", charge: "star", tincture: "nope" }, [{ key: "charge.star", boughtAt: "" }])).toEqual({
      shield: "heater",
      charge: "star",
      tincture: "burgundy",
    });
  });

  it("часть покупается один раз за фиксированную цену", () => {
    const star = CREST_PARTS.find((p) => p.key === "charge.star");
    if (!star) throw new Error("нет звезды");
    const outcome = planBuyCrestPart(turn({ character: character({ gold: 50 }) }), star, []);
    expect(outcome.character.gold).toBe(10);
    expect(outcome.crestParts).toEqual([{ key: "charge.star", uid: "uid-1" }]);
    expect(outcome.ledger[0]).toMatchObject({ sourceType: "purchase", goldDelta: -40, note: "Герб: Звезда" });
    expect(() => planBuyCrestPart(turn({ character: character({ gold: 50 }) }), star, [{ key: "charge.star", boughtAt: "" }])).toThrow();
    expect(() => planBuyCrestPart(turn(), star, [])).toThrow();
  });
});

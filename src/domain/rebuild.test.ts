import { describe, expect, it } from "vitest";

import { character, day, settings } from "./fixtures.test-helpers";
import type { Perk } from "./gear";
import { planRebuild } from "./rebuild";
import { addDays } from "./time";
import type { TurnContext } from "./turns";
import type { LedgerEntry } from "./types";

const today = "2026-10-27";

function turn(overrides: Partial<TurnContext> = {}): TurnContext {
  return {
    character: character(),
    settings,
    days: [],
    today,
    now: new Date("2026-10-27T12:00:00.000Z"),
    gear: [],
    perks: new Set<Perk>(),
    uid: () => "uid",
    ...overrides,
  };
}

let nextId = 0;

function entry(overrides: Partial<LedgerEntry>): LedgerEntry {
  nextId += 1;
  return {
    id: nextId,
    occurredAt: `2026-10-27T10:00:${String(nextId % 60).padStart(2, "0")}.000Z`,
    gameDate: today,
    sourceType: "quest",
    sourceId: 1,
    xpDelta: 0,
    goldDelta: 0,
    attribute: null,
    attributeDelta: 0,
    revertsId: null,
    note: null,
    ...overrides,
  };
}

describe("пересчёт героя после сверки", () => {
  it("складывает дела с обоих устройств: опыт, золото, атрибуты и дела дней", () => {
    const ledger = [
      entry({ gameDate: "2026-10-26", xpDelta: 30, goldDelta: 10, attribute: "intellect", attributeDelta: 2 }),
      entry({ sourceType: "ritual", xpDelta: 5, goldDelta: 2, attribute: "strength", attributeDelta: 1 }),
      entry({ sourceType: "purchase", goldDelta: -4 }),
    ];
    const days = [day("2026-10-26", 1), day(today, 0, false)];
    const { character: hero, days: changed } = planRebuild(turn(), ledger, days);
    expect(hero).toMatchObject({ xp: 35, gold: 8, intellect: 2, strength: 1, agility: 0, streakCurrent: 2, streakBest: 2 });
    expect(changed).toEqual([{ gameDate: today, kind: "normal", deedsCount: 1, closedAt: null }]);
  });

  it("прощает золото, потраченное дважды без сети, и не платит дважды за одно достижение", () => {
    const ledger = [
      entry({ sourceType: "achievement", sourceId: null, goldDelta: 25, note: "first_quest" }),
      entry({ sourceType: "achievement", sourceId: null, goldDelta: 25, note: "first_quest" }),
      entry({ sourceType: "purchase", goldDelta: -20 }),
      entry({ sourceType: "purchase", goldDelta: -20 }),
    ];
    expect(planRebuild(turn(), ledger, []).character.gold).toBe(0);
    const once = planRebuild(turn(), ledger.slice(0, 2), []);
    expect(once.character.gold).toBe(25);
  });

  it("отменённое дело не считается, а пропуск оставляет усталость до следующего дела", () => {
    const done = entry({ gameDate: "2026-10-25", xpDelta: 10, goldDelta: 3 });
    const ledger = [done, entry({ gameDate: "2026-10-25", sourceType: "revert", xpDelta: -10, goldDelta: -3, revertsId: done.id, note: "quest" })];
    const days = [day("2026-10-24", 1), day("2026-10-25", 1)];
    const rebuilt = planRebuild(turn(), [...ledger, entry({ gameDate: "2026-10-24", xpDelta: 10 })], days);
    expect(rebuilt.days.find((d) => d.gameDate === "2026-10-25")?.deedsCount).toBe(0);
    expect(rebuilt.character.fatiguedSince).toBe("2026-10-26");
    expect(rebuilt.character.xp).toBe(10);

    const revived = planRebuild(turn(), [...ledger, entry({ gameDate: "2026-10-24", xpDelta: 10 }), entry({ xpDelta: 10 })], days);
    expect(revived.character.fatiguedSince).toBeNull();
  });

  it("неделя дел подряд поднимает «Попутный ветер», лучшая серия не уменьшается", () => {
    const start = "2026-10-20";
    const ledger = Array.from({ length: 7 }, (_, i) => entry({ gameDate: addDays(start, i), xpDelta: 10 }));
    const rebuilt = planRebuild(turn({ character: character({ streakBest: 12 }) }), ledger, []);
    expect(rebuilt.character).toMatchObject({ windStep: 1, streakCurrent: 7, streakBest: 12, fatiguedSince: null });
    expect(rebuilt.days.filter((d) => d.closedAt !== null)).toHaveLength(7);
  });
});

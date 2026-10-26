import { describe, expect, it } from "vitest";

import { comebacks, GLORY, gloryProgress, gloryStats, nearestGlory, newlyEarned, planGlory, TIER_GOLD, type GloryStats } from "./achievements";
import { character, day, quest, settings } from "./fixtures.test-helpers";
import type { LedgerTally } from "./types";

const today = "2026-10-26";

const zero: GloryStats = {
  questsDone: 0,
  mainOnTime: 0,
  bossesDefeated: 0,
  legendaryBosses: 0,
  level: 1,
  streakBest: 0,
  strength: 0,
  intellect: 0,
  agility: 0,
  ritualMarks: 0,
  ritualBest: 0,
  purchases: 0,
  restDays: 0,
  comebacks: 0,
};

describe("Зал славы: каталог", () => {
  it("ключи уникальны, цели положительны", () => {
    expect(new Set(GLORY.map((d) => d.key)).size).toBe(GLORY.length);
    expect(GLORY.every((d) => d.target > 0)).toBe(true);
  });
});

describe("Зал славы: подсчёт из истории", () => {
  it("журнал без отмен, главные в срок, ритуалы по лучшему", () => {
    const tally: LedgerTally[] = [
      { sourceType: "quest", sourceId: 1, count: 1 },
      { sourceType: "quest", sourceId: 2, count: 1 },
      { sourceType: "ritual", sourceId: 1, count: 4 },
      { sourceType: "ritual", sourceId: 2, count: 9 },
      { sourceType: "boss_defeat", sourceId: 10, count: 1 },
      { sourceType: "purchase", sourceId: 3, count: 2 },
    ];
    const quests = [
      quest({ id: 1, type: "main", status: "done", dueDate: "2026-10-26", completedAt: "2026-10-26T10:00:00.000Z" }),
      quest({ id: 2, type: "main", status: "done", dueDate: "2026-10-20", completedAt: "2026-10-26T10:00:00.000Z" }),
      quest({ id: 3, type: "main", status: "done", dueDate: null, completedAt: "2026-10-26T10:00:00.000Z" }),
    ];
    const stats = gloryStats(character({ level: 3, streakBest: 4 }), tally, quests, [], [], 4);
    expect(stats).toMatchObject({ questsDone: 2, mainOnTime: 2, ritualMarks: 13, ritualBest: 9, bossesDefeated: 1, purchases: 2, level: 3 });
  });

  it("возвращение: успешный день после закрытого пустого", () => {
    const days = [day("2026-10-20", 2), day("2026-10-21", 0), day("2026-10-22", 0), day("2026-10-23", 1), day("2026-10-24", 0), day(today, 1, false)];
    expect(comebacks(days)).toBe(2);
    expect(comebacks([day("2026-10-20", 1), day("2026-10-21", 1)])).toBe(0);
  });
});

describe("Зал славы: открытие", () => {
  it("открывает заслуженные и не повторяет записанные", () => {
    const stats = { ...zero, questsDone: 12, streakBest: 3 };
    const earned = newlyEarned(stats, []).map((d) => d.key);
    expect(earned).toEqual(expect.arrayContaining(["first_quest", "quests_10", "streak_3"]));
    expect(earned).not.toContain("quests_50");
    const again = newlyEarned(stats, [{ key: "first_quest", unlockedAt: "2026-10-25T10:00:00.000Z" }]).map((d) => d.key);
    expect(again).not.toContain("first_quest");
  });

  it("достижение остаётся, даже если счётчик упал после отмены", () => {
    const progress = gloryProgress({ ...zero }, [{ key: "first_quest", unlockedAt: "2026-10-25T10:00:00.000Z" }]);
    expect(progress.find((p) => p.def.key === "first_quest")?.unlockedAt).not.toBeNull();
    expect(newlyEarned(zero, [])).toEqual([]);
  });

  it("ближайшая слава: самая близкая в долях из начатых", () => {
    const near = nearestGlory(gloryProgress({ ...zero, questsDone: 8, streakBest: 5 }, []));
    expect(near?.def.key).toBe("quests_10");
  });

  it("золото по ступеням ложится в журнал и сундук одной записью на достижение", () => {
    const ctx = { character: character({ gold: 10 }), settings, days: [], today, now: new Date("2026-10-26T10:00:00.000Z") };
    const earned = newlyEarned({ ...zero, questsDone: 10 }, []);
    let n = 0;
    const outcome = planGlory(ctx, earned, () => `uid-${String((n += 1))}`);
    const gold = earned.reduce((s, d) => s + TIER_GOLD[d.tier], 0);
    expect(outcome.character.gold).toBe(10 + gold);
    expect(outcome.ledger.map((e) => [e.sourceType, e.note])).toEqual(earned.map((d) => ["achievement", d.key]));
    expect(outcome.achievements).toEqual(earned.map((d, i) => ({ key: d.key, uid: `uid-${String(i + 1)}` })));
  });
});

import { describe, expect, it } from "vitest";

import { GLORY, gloryByKey } from "./achievements";
import { character, day, quest, settings } from "./fixtures.test-helpers";
import { absenceBefore, bestMonth, deedsTotal, favoriteAttribute, journeyDays, returnAbsence, smallStep, staleQuests, weakestBoss } from "./journey";
import { humanMonth } from "./time";
import type { Day } from "./types";

const today = "2026-10-27";

describe("дни в походе", () => {
  it("считает дни с делами за всё время, не подряд, без дней отдыха", () => {
    const rest: Day = { gameDate: "2026-10-03", kind: "rest", deedsCount: 0, closedAt: "x" };
    const days = [day("2026-10-01", 2), day("2026-10-02", 0), rest, day("2026-10-10", 1), day("2026-09-01", 4)];
    expect(journeyDays(days)).toBe(3);
    expect(deedsTotal(days)).toBe(7);
  });

  it("лучший месяц: больше всего дней, при равенстве поздний", () => {
    expect(bestMonth([day("2026-09-01", 1), day("2026-10-01", 1), day("2026-10-05", 0)])).toEqual({ month: "2026-10", days: 1 });
    expect(bestMonth([day("2026-09-01", 1), day("2026-09-02", 1), day("2026-10-01", 1)])).toEqual({ month: "2026-09", days: 2 });
    expect(bestMonth([])).toBeNull();
    expect(humanMonth("2026-03")).toBe("март 2026");
  });

  it("любимый атрибут только когда один впереди", () => {
    expect(favoriteAttribute(character({ strength: 5, intellect: 9, agility: 3 }))).toBe("intellect");
    expect(favoriteAttribute(character({ strength: 5, intellect: 5, agility: 3 }))).toBeNull();
  });

  it("вехи похода лежат в Зале славы", () => {
    expect(GLORY.filter((d) => d.branch === "journey").map((d) => d.target)).toEqual([10, 30, 60, 100, 200, 365]);
    expect(gloryByKey("journey_365")?.tier).toBe(4);
  });
});

describe("возвращение странника", () => {
  const away = [day("2026-10-20", 3), day("2026-10-21", 0), day("2026-10-22", 0), day("2026-10-23", 0), day("2026-10-24", 0), day("2026-10-25", 0), day("2026-10-26", 0)];

  it("перерыв считается до последнего дня с делом или отдыхом", () => {
    expect(absenceBefore(away, today)).toEqual({ lastActive: "2026-10-20", days: 6 });
    const rest: Day = { gameDate: "2026-10-25", kind: "rest", deedsCount: 0, closedAt: "x" };
    expect(absenceBefore([...away.filter((d) => d.gameDate !== "2026-10-25"), rest], today)).toEqual({ lastActive: "2026-10-25", days: 1 });
  });

  it("новичок без единого дела не возвращается", () => {
    expect(absenceBefore([day("2026-10-25", 0), day("2026-10-26", 0)], today)).toBeNull();
  });

  it("карточка после порога, один раз на перерыв и пока сегодня пусто", () => {
    expect(returnAbsence(away, today, settings)?.days).toBe(6);
    expect(returnAbsence(away.slice(0, 3), "2026-10-23", settings)).toBeNull();
    expect(returnAbsence(away, today, { ...settings, returnSeen: "2026-10-20" })).toBeNull();
    expect(returnAbsence([...away, day(today, 1, false)], today, settings)).toBeNull();
    expect(returnAbsence(away, today, { ...settings, journey: { ...settings.journey, returnAfterDays: 7 } })).toBeNull();
  });

  it("малый шаг: самый лёгкий, сначала взятый на сегодня, побочный раньше главного", () => {
    const quests = [
      quest({ id: 1, type: "main", difficulty: 1, scheduledDate: null }),
      quest({ id: 2, type: "side", difficulty: 2, scheduledDate: today }),
      quest({ id: 3, type: "side", difficulty: 1, scheduledDate: null }),
      quest({ id: 4, type: "side", difficulty: 1, scheduledDate: "2026-10-26" }),
      quest({ id: 5, type: "side", difficulty: 1, status: "done", completedAt: "2026-10-01T10:00:00Z" }),
    ];
    expect(smallStep(quests, today)?.id).toBe(4);
    expect(smallStep(quests.filter((q) => q.id !== 4), today)?.id).toBe(3);
    expect(smallStep([], today)).toBeNull();
  });

  it("застрявшие квесты: взятые на прошлые дни, без прошедшего дедлайна", () => {
    const quests = [
      quest({ id: 1, scheduledDate: "2026-10-20" }),
      quest({ id: 2, scheduledDate: "2026-10-20", dueDate: "2026-10-22" }),
      quest({ id: 3, scheduledDate: today }),
      quest({ id: 4, scheduledDate: "2026-10-20", dueDate: "2026-11-01" }),
      quest({ id: 5, type: "boss", scheduledDate: "2026-10-20" }),
    ];
    expect(staleQuests(quests, today).map((q) => q.id)).toEqual([1, 4]);
  });

  it("ближайший босс: меньше всего HP", () => {
    const quests = [
      quest({ id: 10, type: "boss", title: "Большой" }),
      quest({ id: 11, type: "stage", parentId: 10, damage: 8 }),
      quest({ id: 20, type: "boss", title: "Малый" }),
      quest({ id: 21, type: "stage", parentId: 20, damage: 3 }),
      quest({ id: 22, type: "stage", parentId: 20, damage: 5, status: "done", completedAt: "2026-10-01T10:00:00Z" }),
    ];
    expect(weakestBoss(quests)).toMatchObject({ boss: { id: 20 }, hp: 3 });
    expect(weakestBoss([])).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { starterPack } from "./starter";
import { addDays } from "./time";

describe("starterPack", () => {
  const today = "2026-10-27";
  const pack = starterPack(today);

  it("раскладывает квесты от сегодняшнего дня и оставляет один без даты", () => {
    const dates = pack.quests.map((q) => q.scheduledDate);
    expect(dates).toContain(today);
    expect(dates).toContain(addDays(today, 1));
    expect(dates).toContain(addDays(today, 2));
    expect(dates.filter((d) => d === null)).toHaveLength(1);
    expect(pack.quests.every((q) => q.type === "main" || q.type === "side")).toBe(true);
  });

  it("срок главного квеста не раньше его дня", () => {
    for (const q of pack.quests.filter((x) => x.dueDate !== null)) {
      expect(q.dueDate !== null && q.scheduledDate !== null && q.dueDate >= q.scheduledDate).toBe(true);
    }
  });

  it("даёт босса с этапами, урон каждого от 1 до 10", () => {
    expect(pack.boss.type).toBe("boss");
    expect(pack.stages.length).toBeGreaterThan(1);
    for (const stage of pack.stages) {
      expect(stage.damage).toBeGreaterThanOrEqual(1);
      expect(stage.damage).toBeLessThanOrEqual(10);
    }
  });

  it("ритуалы начинаются сегодня, награды стоят золота", () => {
    expect(pack.rituals.every((r) => r.startDate === today)).toBe(true);
    expect(pack.rewards.every((r) => r.price > 0)).toBe(true);
  });
});

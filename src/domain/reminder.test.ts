import { describe, expect, it } from "vitest";

import { day, settings } from "./fixtures.test-helpers";
import { reminderBody, reminderMoment, reminderPlan } from "./reminder";
import type { Day } from "./types";

const today = "2026-10-27"; // вторник
const on = { ...settings, reminder: { enabled: true, hour: 19, quietWeekdays: [] } };

describe("мягкое напоминание", () => {
  it("выключено по умолчанию", () => {
    expect(reminderPlan(new Date(2026, 9, 27, 10), today, settings, [])).toEqual([]);
  });

  it("одно в сутки на неделю вперёд в выбранный час", () => {
    const plan = reminderPlan(new Date(2026, 9, 27, 10), today, on, []);
    expect(plan).toHaveLength(7);
    expect(plan[0]?.at).toEqual(new Date(2026, 9, 27, 19));
    expect(plan[6]?.gameDate).toBe("2026-11-02");
  });

  it("сегодня не зовёт, если дело уже сделано или час прошёл", () => {
    expect(reminderPlan(new Date(2026, 9, 27, 10), today, on, [day(today, 1, false)])[0]?.gameDate).toBe("2026-10-28");
    expect(reminderPlan(new Date(2026, 9, 27, 20), today, on, [])[0]?.gameDate).toBe("2026-10-28");
  });

  it("молчит в тихие дни и в дни отдыха", () => {
    const rest: Day = { gameDate: "2026-10-28", kind: "rest", deedsCount: 0, closedAt: null };
    const quiet = { ...on, reminder: { ...on.reminder, quietWeekdays: [5, 6] } };
    const dates = reminderPlan(new Date(2026, 9, 27, 10), today, quiet, [rest]).map((r) => r.gameDate);
    expect(dates).toEqual(["2026-10-27", "2026-10-29", "2026-10-30", "2026-11-02"]);
  });

  it("час до начала суток относится к следующей календарной дате", () => {
    expect(reminderMoment(today, 1, 4)).toEqual(new Date(2026, 9, 28, 1));
    expect(reminderMoment(today, 19, 4)).toEqual(new Date(2026, 9, 27, 19));
  });

  it("тексты по кругу и без упрёков", () => {
    const bodies = Array.from({ length: 5 }, (_, i) => reminderBody(`2026-10-${String(26 + i)}`));
    expect(new Set(bodies).size).toBe(5);
    expect(bodies.join(" ")).not.toMatch(/серия|потеря|пропуск/i);
  });
});

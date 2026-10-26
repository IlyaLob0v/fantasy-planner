import { describe, expect, it } from "vitest";

import { character, day, realReward, ritual, settings } from "./fixtures.test-helpers";
import { blankRitual, describeSchedule, isDue, prepareRitual, ritualFieldsOf, ritualProblem, ritualsForToday } from "./rituals";
import { mergeRates } from "./settings";
import { isOnSale, restDaysAhead, unusedRewards } from "./shop";
import { currentStreak } from "./streak";
import { planBuyReward, planBuyRest, planRitual, planUndoRitual, type TurnContext } from "./turns";
import type { InventoryItem, LedgerEntry, RitualCompletion, RitualFields } from "./types";

const today = "2026-10-28"; // среда
const now = new Date("2026-10-28T12:00:00.000Z");

function ctx(overrides: Partial<TurnContext> = {}): TurnContext {
  return { character: character(), settings, days: [day(today, 0, false)], today, now, gear: [], perks: new Set(), uid: () => "uid", ...overrides };
}

function done(ritualId: number, gameDate: string): RitualCompletion {
  return { ritualId, gameDate, completedAt: `${gameDate}T10:00:00.000Z` };
}

describe("расписание ритуалов", () => {
  it("каждый день и по дням недели", () => {
    expect(isDue(ritual(), [], today)).toBe(true);
    const monWedFri = ritual({ schedule: "weekdays", weekdaysMask: 0b10101 });
    expect(isDue(monWedFri, [], today)).toBe(true);
    expect(isDue(monWedFri, [], "2026-10-29")).toBe(false);
    expect(describeSchedule(monWedFri)).toBe("пн, ср, пт");
  });

  it("N раз в неделю: виден, пока норма недели не набрана, и в день отметки", () => {
    const twice = ritual({ schedule: "times_per_week", timesPerWeek: 2 });
    expect(isDue(twice, [done(1, "2026-10-26")], today)).toBe(true);
    expect(isDue(twice, [done(1, "2026-10-26"), done(1, "2026-10-27")], today)).toBe(false);
    expect(isDue(twice, [done(1, "2026-10-26"), done(1, today)], today)).toBe(true);
    expect(isDue(twice, [done(1, "2026-10-19"), done(1, "2026-10-20")], today)).toBe(true);
    expect(describeSchedule(twice)).toBe("2 раза в неделю");
  });

  it("раз в N дней от даты начала, пауза и будущий старт", () => {
    const everyThird = ritual({ schedule: "every_n_days", intervalDays: 3, startDate: "2026-10-22" });
    expect(isDue(everyThird, [], today)).toBe(true);
    expect(isDue(everyThird, [], "2026-10-29")).toBe(false);
    expect(describeSchedule(everyThird)).toBe("раз в 3 дня");
    expect(isDue(ritual({ pausedUntil: "2026-10-30" }), [], today)).toBe(false);
    expect(isDue(ritual({ startDate: "2026-11-01" }), [], today)).toBe(false);
  });

  it("список дня отмечает сделанные", () => {
    const list = ritualsForToday([ritual(), ritual({ id: 2 })], [done(2, today)], today);
    expect(list.map((r) => [r.ritual.id, r.done])).toEqual([
      [1, false],
      [2, true],
    ]);
  });
});

describe("ритуал как дело", () => {
  it("даёт награду, отметку и снимает усталость; отмена возвращает всё", () => {
    const result = planRitual(ctx({ character: character({ fatiguedSince: "2026-10-27" }) }), ritual({ difficulty: 2 }));
    expect(result.reward).toMatchObject({ xp: 10, gold: 4, attribute: "strength", attributeDelta: 2 });
    expect(result.outcome.ritual).toEqual({ ritualId: 1, gameDate: today, done: true });
    expect(result.outcome.character.fatiguedSince).toBeNull();

    const hero = character({ ...result.outcome.character });
    const ledger: LedgerEntry[] = result.outcome.ledger.map((e, i) => ({ ...e, id: i + 1, occurredAt: now.toISOString() }));
    const undo = planUndoRitual(ctx({ character: hero, days: result.outcome.days }), ritual(), ledger);
    expect(undo.ritual).toEqual({ ritualId: 1, gameDate: today, done: false });
    expect(undo.character).toMatchObject({ xp: 0, gold: 0, strength: 0 });
  });
});

describe("лавка", () => {
  const bought: InventoryItem = {
    id: 1,
    itemType: "reward",
    itemName: "Вечер в таверне",
    rarity: "common",
    assetKey: null,
    sourceType: "purchase",
    sourceId: 1,
    obtainedAt: "2026-10-27T10:00:00.000Z",
    redeemedAt: null,
  };

  it("покупка списывает золото и кладёт награду в сундук", () => {
    const outcome = planBuyReward(ctx({ character: character({ gold: 60 }) }), realReward());
    expect(outcome.character.gold).toBe(10);
    expect(outcome.inventory).toEqual([
      { itemType: "reward", itemName: "Вечер в таверне", rarity: "common", assetKey: null, sourceType: "purchase", sourceId: 1 },
    ]);
    expect(outcome.ledger[0]).toMatchObject({ sourceType: "purchase", goldDelta: -50, xpDelta: 0 });
  });

  it("без золота купить нельзя", () => {
    expect(() => planBuyReward(ctx({ character: character({ gold: 49 }) }), realReward())).toThrow();
  });

  it("разовая награда пропадает из лавки после покупки", () => {
    expect(isOnSale(realReward({ repeatable: false }), [bought])).toBe(false);
    expect(isOnSale(realReward(), [bought])).toBe(true);
    expect(unusedRewards([bought, { ...bought, id: 2, redeemedAt: "2026-10-28T00:00:00.000Z" }])).toHaveLength(1);
  });
});

describe("день отдыха", () => {
  it("на завтра: золото списано, день помечен, серия считается", () => {
    const outcome = planBuyRest(ctx({ character: character({ gold: 45 }) }), "2026-10-29");
    expect(outcome.character.gold).toBe(5);
    expect(outcome.days).toEqual([{ gameDate: "2026-10-29", kind: "rest", deedsCount: 0, closedAt: null }]);
  });

  it("на сегодня снимает усталость и держит серию", () => {
    const days = [day("2026-10-27", 1), day(today, 0, false)];
    const outcome = planBuyRest(ctx({ days, character: character({ gold: 40, fatiguedSince: "2026-10-26" }) }), today);
    expect(outcome.character.fatiguedSince).toBeNull();
    expect(outcome.character.streakCurrent).toBe(2);
    expect(currentStreak([...days.slice(0, 1), ...outcome.days], today)).toBe(2);
  });

  it("нельзя в прошлое и дважды", () => {
    expect(() => planBuyRest(ctx({ character: character({ gold: 100 }) }), "2026-10-27")).toThrow();
    const rest = { ...day("2026-10-29", 0, false), kind: "rest" as const };
    expect(() => planBuyRest(ctx({ character: character({ gold: 100 }), days: [rest] }), "2026-10-29")).toThrow();
  });
});

describe("настройки", () => {
  it("правка ставок пишет все известные ставки", () => {
    const raw = { rates: { side: { xp: 1, gold: 1 } } };
    const merged = mergeRates(raw, settings.rates);
    expect(merged["stage"]).toEqual({ xp: 15, gold: 4 });
    expect(merged["side"]).toEqual(settings.rates.side);
    expect(merged["rest_action"]).toEqual(settings.rates.restAction);
  });
});

describe("редактор ритуала", () => {
  it("проверяет название и параметры расписания", () => {
    const d = blankRitual("2026-10-26", 0);
    expect(ritualProblem(d)).not.toBeNull();
    expect(ritualProblem({ ...d, title: "Обет", schedule: "weekdays", weekdaysMask: 0 })).not.toBeNull();
    expect(ritualProblem({ ...d, title: "Обет", schedule: "weekdays", weekdaysMask: 1 })).toBeNull();
  });

  it("новое расписание действует с сегодняшнего дня, правка названия старт не двигает", () => {
    const r = ritual({ schedule: "every_n_days", intervalDays: 3, startDate: "2026-10-01" });
    const renamed = prepareRitual(r, { ...ritualFieldsOf(r), title: "  Новое имя " }, "2026-10-26");
    expect(renamed.startDate).toBe("2026-10-01");
    expect(renamed.title).toBe("Новое имя");
    const rescheduled = prepareRitual(r, { ...ritualFieldsOf(r), intervalDays: 2 }, "2026-10-26");
    expect(rescheduled.startDate).toBe("2026-10-26");
  });

  it("убирает параметры чужого расписания", () => {
    const d: RitualFields = { ...blankRitual("2026-10-26", 0), title: "Обет", schedule: "daily", weekdaysMask: 5, intervalDays: 3 };
    const clean = prepareRitual(null, d, "2026-10-26");
    expect(clean.weekdaysMask).toBeNull();
    expect(clean.intervalDays).toBeNull();
  });
});

describe("дни отдыха впереди", () => {
  it("только будущие и сегодняшний, по порядку", () => {
    const rest = (date: string) => ({ ...day(date, 0, false), kind: "rest" as const });
    const days = [rest("2026-10-30"), rest("2026-10-20"), rest("2026-10-26"), day("2026-10-27", 1, false)];
    expect(restDaysAhead(days, "2026-10-26")).toEqual(["2026-10-26", "2026-10-30"]);
  });
});

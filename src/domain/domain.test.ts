import { describe, expect, it } from "vitest";

import { applyReward, stateOf } from "./character";
import { character, day, quest, settings } from "./fixtures.test-helpers";
import { levelProgress, titleForLevel, xpToNext } from "./levels";
import { dayLoad, MAP_DAYS, questMap, todayBoard } from "./quests";
import { questReward, windBonusPct } from "./rewards";
import { parseSettings } from "./settings";
import { closePastDays, currentStreak } from "./streak";
import { addDays, daysBetween, gameDate, weekday } from "./time";
import { planCompleteQuest, planDayClose, planRestAction, planUndoQuest, type TurnContext } from "./turns";
import type { LedgerEntry } from "./types";

const today = "2026-10-26";
const now = new Date("2026-10-26T12:00:00.000Z");

function ctx(overrides: Partial<TurnContext> = {}): TurnContext {
  return { character: character(), settings, days: [day(today, 0, false)], today, now, gear: [], perks: new Set(), uid: () => "uid", ...overrides };
}

describe("время", () => {
  it("игровые сутки начинаются в 04:00", () => {
    expect(gameDate(new Date(2026, 9, 26, 3, 59), 4)).toBe("2026-10-25");
    expect(gameDate(new Date(2026, 9, 26, 4, 0), 4)).toBe("2026-10-26");
  });
  it("арифметика дат", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-10-20", "2026-10-26")).toBe(6);
    expect(weekday("2026-10-26")).toBe(0);
  });
});

describe("уровни", () => {
  it("кривая: 50 XP до второго уровня, дальше растёт", () => {
    expect(xpToNext(1, settings.levelCurve)).toBe(50);
    expect(xpToNext(2, settings.levelCurve)).toBe(130);
    expect(levelProgress(49, settings.levelCurve).level).toBe(1);
    expect(levelProgress(50, settings.levelCurve)).toEqual({ level: 2, into: 0, needed: 130 });
  });
  it("титулы", () => {
    expect(titleForLevel(1)).toBe("Странник");
    expect(titleForLevel(5)).toBe("Страж ворот");
    expect(titleForLevel(99)).toBe("Владыка замка");
  });
});

describe("награды", () => {
  it("ставка × сложность", () => {
    expect(questReward(quest({ type: "main", difficulty: 3 }), settings, 0)).toEqual({
      xp: 90,
      gold: 30,
      attribute: "strength",
      attributeDelta: 3,
    });
  });
  it("«Попутный ветер» добавляет золото, но не XP, и ограничен потолком", () => {
    expect(questReward(quest({ type: "main" }), settings, 2)).toMatchObject({ xp: 30, gold: 12 });
    expect(windBonusPct(5, settings.streakBonus)).toBe(30);
  });
  it("золото не уходит в минус при отмене", () => {
    const state = stateOf(character({ gold: 2 }));
    expect(() => applyReward(state, { xp: 0, gold: 3, attribute: null, attributeDelta: 0 }, -1, settings.levelCurve)).toThrow();
  });
});

describe("серия и усталость", () => {
  it("серия считается до вчера, если сегодня ещё ничего не сделано", () => {
    const days = [day("2026-10-24", 1), day("2026-10-25", 2), day(today, 0, false)];
    expect(currentStreak(days, today)).toBe(2);
    expect(currentStreak([...days.slice(0, 2), day(today, 1, false)], today)).toBe(3);
  });

  it("пропуск включает усталость и опускает ветер на одну ступень, не обнуляя", () => {
    const days = [day("2026-10-23", 1), day("2026-10-24", 1, false)];
    const result = closePastDays(days, today, 2, null, settings.streakBonus, now.toISOString());
    expect(result.windStep).toBe(1);
    expect(result.fatiguedSince).toBe("2026-10-25");
    expect(result.changed.map((d) => d.gameDate)).toEqual(["2026-10-24", "2026-10-25", today]);
  });

  it("каждые 7 дней серии поднимают ветер", () => {
    const days = Array.from({ length: 7 }, (_, i) => day(addDays("2026-10-19", i), 1, i < 6));
    const result = closePastDays(days, today, 0, null, settings.streakBonus, now.toISOString());
    expect(result.windStep).toBe(1);
    expect(result.fatiguedSince).toBeNull();
  });

  it("день отдыха не прерывает серию", () => {
    const days = [day("2026-10-24", 1), { ...day("2026-10-25", 0), kind: "rest" as const }];
    expect(currentStreak(days, today)).toBe(2);
  });

  it("первый запуск просто создаёт сегодняшний день", () => {
    const plan = planDayClose(ctx({ days: [] }));
    expect(plan?.outcome.days).toEqual([{ gameDate: today, kind: "normal", deedsCount: 0, closedAt: null }]);
    expect(plan?.outcome.character.fatiguedSince).toBeNull();
  });

  it("повторное закрытие ничего не пишет", () => {
    expect(planDayClose(ctx())).toBeNull();
  });
});

describe("ходы", () => {
  it("выполнение квеста: награда, серия, снятие усталости", () => {
    const result = planCompleteQuest(ctx({ character: character({ fatiguedSince: "2026-10-25", xp: 45 }) }), quest({ difficulty: 2 }));
    expect(result.reward).toMatchObject({ xp: 20, gold: 6 });
    expect(result.outcome.character).toMatchObject({ xp: 65, gold: 6, strength: 2, level: 2, streakCurrent: 1, fatiguedSince: null });
    expect(result.levelUp).toBe(2);
    expect(result.revived).toBe(true);
    expect(result.outcome.days[0]?.deedsCount).toBe(1);
  });

  it("привал тоже дело: снимает усталость без атрибута", () => {
    const result = planRestAction(ctx({ character: character({ fatiguedSince: "2026-10-25" }) }), { id: 1, title: "Выпить воды" });
    expect(result.outcome.character).toMatchObject({ xp: 3, gold: 0, strength: 0, fatiguedSince: null });
    expect(result.outcome.ledger[0]).toMatchObject({ sourceType: "rest_action", note: "Выпить воды" });
  });

  it("отмена возвращает всё, кроме усталости", () => {
    const done = planCompleteQuest(ctx(), quest());
    const hero = character({ ...done.outcome.character });
    const ledger: LedgerEntry[] = done.outcome.ledger.map((e, i) => ({ ...e, id: i + 10, occurredAt: now.toISOString() }));
    const undo = planUndoQuest(ctx({ character: hero, days: done.outcome.days }), quest({ status: "done" }), ledger);
    expect(undo.character).toMatchObject({ xp: 0, gold: 0, strength: 0, streakCurrent: 0, fatiguedSince: null });
    expect(undo.ledger[0]).toMatchObject({ sourceType: "revert", revertsId: 10, xpDelta: -10 });
    expect(undo.quests).toEqual([{ id: 1, status: "active", completedAt: null }]);
    const [first] = ledger;
    expect(first).toBeDefined();
    if (first) {
      expect(() => planUndoQuest(ctx(), quest(), [first, { ...first, id: 11, sourceType: "revert", revertsId: 10 }])).toThrow();
    }
  });
});

describe("доска квестов", () => {
  const list = [
    quest({ id: 1, type: "side", scheduledDate: today }),
    quest({ id: 2, type: "main", scheduledDate: null, dueDate: "2026-10-20" }),
    quest({ id: 3, type: "main", scheduledDate: "2026-10-30" }),
    quest({ id: 4, scheduledDate: null }),
    quest({ id: 5, status: "done", completedAt: "2026-10-26T10:00:00.000Z" }),
  ];
  it("сегодня: просроченные сверху, затем main, затем side", () => {
    const board = todayBoard(list, today, 4);
    expect(board.active.map((q) => q.id)).toEqual([2, 1]);
    expect(board.done.map((q) => q.id)).toEqual([5]);
  });
  it("карта похода: сегодня с просроченным, дни недели, без даты, позже", () => {
    const map = questMap([...list, quest({ id: 6, scheduledDate: "2026-11-10" })], today, 4);
    expect(map.days).toHaveLength(MAP_DAYS);
    expect(map.days[0]?.quests.map((q) => q.id)).toEqual([2, 1]);
    expect(map.days[4]).toEqual({ date: "2026-10-30", quests: [expect.objectContaining({ id: 3 })] });
    expect(map.backlog.map((q) => q.id)).toEqual([4]);
    expect(map.later.map((q) => q.id)).toEqual([6]);
    expect(map.archive.map((q) => q.id)).toEqual([5]);
  });
  it("последний день карты ещё на карте, следующий уже позже", () => {
    const map = questMap([quest({ id: 7, scheduledDate: "2026-11-01" }), quest({ id: 8, scheduledDate: "2026-11-02" })], today, 4);
    expect(map.days[6]?.quests.map((q) => q.id)).toEqual([7]);
    expect(map.later.map((q) => q.id)).toEqual([8]);
  });
  it("нагрузка дня: XP только за задачи", () => {
    const boss = quest({ id: 9, type: "boss" });
    const load = dayLoad([quest({ id: 1, type: "side" }), quest({ id: 2, type: "main", difficulty: 2 }), boss], settings, 0);
    expect(load).toEqual({ count: 3, xp: 10 + 60 });
  });
});

describe("настройки", () => {
  it("разбирает сид миграции и падает на битых данных", () => {
    const raw = {
      day_start_hour: 4,
      rates: {
        side: { xp: 10, gold: 3 },
        main: { xp: 30, gold: 10 },
        stage: { xp: 15, gold: 4 },
        boss_defeat: { xp: 60, gold: 25 },
        ritual: { xp: 5, gold: 2 },
        rest_action: { xp: 3, gold: 0 },
      },
      rest_price: 40,
      streak_bonus: { step_days: 7, step_pct: 10, max_pct: 30 },
      level_curve: { base: 50, exp: 1.4, round: 5 },
      motion: "full",
      loot: {
        base_pct: 12,
        step_pct: 4,
        pity: 15,
        daily_cap: 2,
        weights: { common: 60, rare: 28, epic: 10, legendary: 2 },
        unlock_level: { common: 1, rare: 5, epic: 10, legendary: 15 },
      },
      forge_prices: { common: 60, rare: 150 },
      week: { goal_gold: 20, chest_gold: 60, stretch_pct: 10 },
      recap_seen: "",
      crest: { shield: "heater", charge: "tower", tincture: "burgundy" },
      crest_price: 40,
    };
    expect(parseSettings(raw)).toEqual(settings);
    expect(() => parseSettings({ ...raw, rates: null })).toThrow();
  });
});

import { describe, expect, it } from "vitest";

import { comebacks, GLORY, gloryProgress, gloryStats, nearestGlory, newlyEarned, planGlory, TIER_GOLD, type GloryStats } from "./achievements";
import { character, day, quest, settings } from "./fixtures.test-helpers";
import { bossFind, findChance, GEAR, gearByKey, RARITIES, restPrice, roll, rollFind, type Perk } from "./gear";
import { closePastDays } from "./streak";
import { planBuyGear, planCompleteQuest, planUndoQuest, type TurnContext } from "./turns";
import type { Gear, LedgerEntry, LedgerTally } from "./types";

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
  journeyDays: 0,
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
    let n = 0;
    const ctx = {
      character: character({ gold: 10 }),
      settings,
      days: [],
      today,
      now: new Date("2026-10-26T10:00:00.000Z"),
      gear: [],
      perks: new Set<Perk>(),
      uid: () => `uid-${String((n += 1))}`,
    };
    const earned = newlyEarned({ ...zero, questsDone: 10 }, []);
    const outcome = planGlory(ctx, earned);
    const gold = earned.reduce((s, d) => s + TIER_GOLD[d.tier], 0);
    expect(outcome.character.gold).toBe(10 + gold);
    expect(outcome.ledger.map((e) => [e.sourceType, e.note])).toEqual(earned.map((d) => ["achievement", d.key]));
    expect(outcome.achievements).toEqual(earned.map((d, i) => ({ key: d.key, uid: `uid-${String(i + 1)}` })));
  });
});

const now = new Date("2026-10-26T12:00:00.000Z");

function turn(overrides: Partial<TurnContext> = {}): TurnContext {
  let n = 0;
  return {
    character: character(),
    settings,
    days: [day(today, 0, false)],
    today,
    now,
    gear: [],
    perks: new Set<Perk>(),
    uid: () => `uid-${String((n += 1))}`,
    ...overrides,
  };
}

function owned(keys: readonly string[], overrides: Partial<Gear> = {}): Gear[] {
  return keys.map((itemKey, i) => ({
    id: i + 1,
    itemKey,
    sourceType: "quest",
    sourceId: 100 + i,
    gameDate: "2026-10-01",
    missesBefore: 0,
    obtainedAt: now.toISOString(),
    ...overrides,
  }));
}

function ledgerOf(entries: ReadonlyArray<Omit<LedgerEntry, "id" | "occurredAt">>): LedgerEntry[] {
  return entries.map((e, i) => ({ ...e, id: 100 + i, occurredAt: now.toISOString() }));
}

const commons = GEAR.filter((g) => g.rarity === "common").map((g) => g.key);

describe("Снаряжение: каталог", () => {
  it("40 предметов в добыче по 8 на слот и 5 реликвий за вехи Зала славы", () => {
    const drops = GEAR.filter((g) => g.relicOf === null);
    expect(drops).toHaveLength(40);
    expect(new Set(GEAR.map((g) => g.key)).size).toBe(GEAR.length);
    const counts = Object.fromEntries(RARITIES.map((r) => [r, drops.filter((g) => g.rarity === r).length]));
    expect(counts).toEqual({ common: 15, rare: 12, epic: 9, legendary: 4 });
    expect(GEAR.filter((g) => g.relicOf !== null).every((g) => GLORY.some((d) => d.key === g.relicOf))).toBe(true);
  });
});

describe("Снаряжение: находки без казино", () => {
  it("бросок детерминирован", () => {
    expect(roll("quest:1:2026-10-26")).toBe(roll("quest:1:2026-10-26"));
    expect(roll("a")).toBeGreaterThanOrEqual(0);
    expect(roll("a")).toBeLessThan(1);
  });

  it("шанс растёт с каждым промахом, на пороге гарантия", () => {
    expect(findChance(0, settings.loot)).toBe(12);
    expect(findChance(3, settings.loot)).toBe(24);
    expect(findChance(14, settings.loot)).toBe(100);
  });

  it("на 1 уровне выпадают только обычные, дублей нет", () => {
    const result = rollFind("seed", 1, 14, owned(commons.slice(0, 14)), today, settings.loot);
    expect(result.found?.key).toBe(commons[14]);
    expect(result.misses).toBe(0);
  });

  it("всё собрано или потолок дня: броска нет, счётчик не растёт", () => {
    expect(rollFind("seed", 1, 5, owned(commons), today, settings.loot)).toEqual({ found: null, misses: 5 });
    const twoToday = owned(["gate_sword", "hunter_bow"], { gameDate: today });
    expect(rollFind("seed", 1, 5, twoToday, today, settings.loot)).toEqual({ found: null, misses: 5 });
  });

  it("за много дел находок примерно одна на 5–6 дел и не больше порога подряд без неё", () => {
    let misses = 0;
    let finds = 0;
    let longest = 0;
    let run = 0;
    for (let i = 0; i < 2000; i += 1) {
      const r = rollFind(`quest:${String(i)}:${today}`, 30, misses, [], `d${String(i)}`, settings.loot);
      if (r.found) {
        finds += 1;
        run = 0;
      } else {
        run += 1;
        longest = Math.max(longest, run);
      }
      misses = r.misses;
    }
    expect(longest).toBeLessThan(settings.loot.pity);
    expect(finds / 2000).toBeGreaterThan(0.12);
    expect(finds / 2000).toBeLessThan(0.3);
  });

  it("трофей босса: редкость по HP, но не выше открытой уровнем", () => {
    expect(bossFind("b", "legendary", 1, [], settings.loot)?.rarity).toBe("common");
    expect(bossFind("b", "epic", 12, [], settings.loot)?.rarity).toBe("epic");
  });
});

describe("Снаряжение: ход", () => {
  const side = quest({ id: 7 });

  it("гарантированная находка на пороге и её отмена с возвратом счётчика", () => {
    const ctx = turn({ character: character({ lootMisses: 14 }) });
    const result = planCompleteQuest(ctx, side);
    expect(result.find).not.toBeNull();
    expect(result.outcome.character.lootMisses).toBe(0);
    expect(result.outcome.gear).toEqual([expect.objectContaining({ sourceType: "quest", sourceId: 7, missesBefore: 14 })]);

    const stored = result.outcome.gear.map((g, i) => ({ ...g, id: 50 + i, obtainedAt: now.toISOString() }));
    const after = turn({ character: { ...character(), ...result.outcome.character }, gear: stored, days: result.outcome.days });
    const undo = planUndoQuest(after, { ...side, status: "done" }, ledgerOf(result.outcome.ledger));
    expect(undo.removeGear).toEqual([50]);
    expect(undo.character.lootMisses).toBe(14);
  });

  it("отмена дела без находки откатывает счётчик на одно дело", () => {
    const ctx = turn({ character: character({ lootMisses: 0 }) });
    const result = planCompleteQuest(ctx, quest({ id: 3 }));
    if (result.find) return;
    expect(result.outcome.character.lootMisses).toBe(1);
    const after = turn({ character: { ...character(), ...result.outcome.character }, days: result.outcome.days });
    const undo = planUndoQuest(after, { ...quest({ id: 3 }), status: "done" }, ledgerOf(result.outcome.ledger));
    expect(undo.character.lootMisses).toBe(0);
    expect(undo.removeGear).toEqual([]);
  });

  it("реликвия приходит вместе с вехой Зала славы", () => {
    const outcome = planGlory(turn(), newlyEarned({ ...zero, streakBest: 30 }, []));
    expect(outcome.gear.map((g) => g.itemKey)).toEqual(["dawn_cloak"]);
    expect(outcome.gear[0]?.sourceType).toBe("achievement");
  });

  it("кузнец: фиксированная цена, скидка от доспеха, эпик не продаётся", () => {
    const rich = turn({ character: character({ gold: 500, level: 6 }) });
    const sword = gearByKey("gate_sword");
    const ember = gearByKey("ember_axe");
    if (!sword || !ember) throw new Error("нет в каталоге");
    expect(planBuyGear(rich, sword).character.gold).toBe(350);
    expect(planBuyGear({ ...rich, perks: new Set<Perk>(["forge_discount"]) }, sword).character.gold).toBe(380);
    expect(() => planBuyGear(rich, ember)).toThrow();
    expect(() => planBuyGear({ ...rich, gear: owned(["gate_sword"]) }, sword)).toThrow();
    expect(() => planBuyGear(turn({ character: character({ gold: 500 }) }), sword)).toThrow();
  });

  it("способности: дешёвый отдых и Плащ странника на одиночный пропуск", () => {
    expect(restPrice(40, new Set<Perk>(["rest_discount"]))).toBe(30);
    const days = [day("2026-10-23", 1), day("2026-10-24", 1), day("2026-10-25", 0, false)];
    expect(closePastDays(days, today, 2, null, settings.streakBonus, now.toISOString(), true).windStep).toBe(2);
    expect(closePastDays(days, today, 2, null, settings.streakBonus, now.toISOString(), false).windStep).toBe(1);
    const twice = [day("2026-10-23", 1), day("2026-10-24", 0, false), day("2026-10-25", 0, false)];
    expect(closePastDays(twice, today, 2, null, settings.streakBonus, now.toISOString(), true).windStep).toBe(1);
  });
});

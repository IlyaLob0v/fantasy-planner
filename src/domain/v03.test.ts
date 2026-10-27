import { describe, expect, it } from "vitest";

import { activeBosses, bossHp, lootRarity, nextStage, stagesOf, trophies } from "./bosses";
import { isBlank, isEvening } from "./chronicle";
import { character, day, quest, settings } from "./fixtures.test-helpers";
import { locationState, unlockedBetween } from "./locations";
import { questMap, reorder, todayBoard } from "./quests";
import { mergeRates } from "./settings";
import { addDays, calendarStart } from "./time";
import { planBuyLocation, planCompleteQuest, planCompleteStage, planUndoStage, type TurnContext } from "./turns";
import type { InventoryItem, LedgerEntry, Location, Quest } from "./types";

const today = "2026-10-26";
const now = new Date("2026-10-26T12:00:00.000Z");

function ctx(overrides: Partial<TurnContext> = {}): TurnContext {
  return { character: character(), settings, days: [day(today, 0, false)], today, now, gear: [], perks: new Set(), uid: () => "uid", inn: new Set(), ...overrides };
}

const boss = quest({ id: 10, type: "boss", title: "Дипломная работа", difficulty: 2, scheduledDate: null });
const stage = (id: number, damage: number, status: Quest["status"] = "active", sortOrder = id): Quest =>
  quest({ id, type: "stage", parentId: 10, title: `Этап ${id}`, damage, status, sortOrder, scheduledDate: null });

function ledgerOf(outcomeLedger: ReadonlyArray<Omit<LedgerEntry, "id" | "occurredAt">>): LedgerEntry[] {
  return outcomeLedger.map((e, i) => ({ ...e, id: 100 + i, occurredAt: now.toISOString() }));
}

function item(overrides: Partial<InventoryItem>): InventoryItem {
  return {
    id: 1,
    itemType: "loot",
    itemName: "Трофей",
    rarity: "common",
    assetKey: null,
    sourceType: "boss",
    sourceId: 10,
    obtainedAt: now.toISOString(),
    redeemedAt: null,
    ...overrides,
  };
}

describe("босс", () => {
  it("HP = сумма урона, выполненные этапы его уже сняли", () => {
    const stages = [stage(1, 3, "done"), stage(2, 5), stage(3, 2)];
    expect(bossHp(stages)).toEqual({ current: 7, max: 10 });
    expect(nextStage(stages)?.id).toBe(2);
  });

  it("этапы по порядку, активные боссы по дедлайну", () => {
    const quests = [boss, stage(2, 1, "active", 1), stage(1, 1, "active", 0), quest({ id: 11, type: "boss", dueDate: "2026-11-01" })];
    expect(stagesOf(quests, 10).map((s) => s.id)).toEqual([1, 2]);
    expect(activeBosses(quests).map((b) => b.id)).toEqual([11, 10]);
  });

  it("обычный этап бьёт по боссу и даёт награду этапа", () => {
    const quests = [boss, stage(1, 3), stage(2, 5)];
    const result = planCompleteStage(ctx(), stage(1, 3), quests);
    expect(result.victory).toBeNull();
    expect(result.reward).toMatchObject({ xp: 15, gold: 4 });
    expect(result.outcome.quests).toEqual([{ id: 1, status: "done", completedAt: now.toISOString() }]);
  });

  it("последний этап побеждает босса: две награды, трофей, одно дело дня", () => {
    const quests = [boss, stage(1, 3, "done"), stage(2, 5)];
    const result = planCompleteStage(ctx(), stage(2, 5), quests);
    expect(result.victory?.loot).toMatchObject({ itemType: "loot", rarity: "rare", sourceId: 10 });
    expect(result.reward.xp).toBe(15 + 120);
    expect(result.outcome.quests.map((q) => q.id)).toEqual([2, 10]);
    expect(result.outcome.days[0]?.deedsCount).toBe(1);
    expect(result.outcome.ledger.map((e) => e.sourceType)).toEqual(["quest", "boss_defeat"]);
  });

  it("отмена победного этапа возвращает босса, награды и забирает трофей", () => {
    const quests = [boss, stage(1, 3, "done"), stage(2, 5)];
    const won = planCompleteStage(ctx(), stage(2, 5), quests);
    const after: TurnContext = ctx({ character: { ...character(), ...won.outcome.character }, days: won.outcome.days });
    const defeated = [{ ...boss, status: "done" as const }, stage(1, 3, "done"), stage(2, 5, "done")];
    const undo = planUndoStage(after, stage(2, 5, "done"), defeated, [item({ id: 7 })], ledgerOf(won.outcome.ledger));
    expect(undo.quests.map((q) => [q.id, q.status])).toEqual([
      [2, "active"],
      [10, "active"],
    ]);
    expect(undo.removeInventory).toEqual([7]);
    expect(undo.character.xp).toBe(0);
    expect(undo.days[0]?.deedsCount).toBe(0);
  });

  it("босс и этапы не выполняются как обычные квесты", () => {
    expect(() => planCompleteQuest(ctx(), boss)).toThrow();
  });

  it("редкость трофея растёт с уроном, сундук показывает редкие первыми", () => {
    expect([3, 6, 13, 25].map(lootRarity)).toEqual(["common", "rare", "epic", "legendary"]);
    const list = trophies([item({ id: 1, rarity: "common" }), item({ id: 2, rarity: "epic" }), item({ id: 3, itemType: "reward" })]);
    expect(list.map((i) => i.id)).toEqual([2, 1]);
  });
});

const forest: Location = { key: "forest", name: "Сосновый бор", assetKey: "location.forest", unlockLevel: 5, price: 120, sortOrder: 1 };
const gatehouse: Location = { key: "gatehouse", name: "Надвратная башня", assetKey: "location.gatehouse", unlockLevel: 1, price: 0, sortOrder: 0 };

describe("локации", () => {
  it("закрыта до уровня, доступна после, своя после покупки, дом отдельно", () => {
    expect(locationState(gatehouse, character(), [])).toBe("home");
    expect(locationState(forest, character({ level: 4 }), [])).toBe("locked");
    expect(locationState(forest, character({ level: 5 }), [])).toBe("available");
    const bought = item({ itemType: "location", assetKey: "location.forest", sourceType: "purchase", sourceId: null });
    expect(locationState(forest, character({ level: 5 }), [bought])).toBe("owned");
    expect(locationState(gatehouse, character({ locationKey: "forest" }), [])).toBe("owned");
  });

  it("покупка списывает золото и кладёт локацию в инвентарь; без уровня и золота нельзя", () => {
    const outcome = planBuyLocation(ctx({ character: character({ level: 5, gold: 150 }) }), forest, []);
    expect(outcome.character.gold).toBe(30);
    expect(outcome.inventory[0]).toMatchObject({ itemType: "location", assetKey: "location.forest" });
    expect(() => planBuyLocation(ctx({ character: character({ level: 4, gold: 150 }) }), forest, [])).toThrow();
    expect(() => planBuyLocation(ctx({ character: character({ level: 5, gold: 100 }) }), forest, [])).toThrow();
  });

  it("повышение уровня сообщает о новых открытых локациях", () => {
    expect(unlockedBetween([gatehouse, forest], 4, 5).map((l) => l.key)).toEqual(["forest"]);
    expect(unlockedBetween([gatehouse, forest], 5, 6)).toEqual([]);
  });
});

describe("хроника", () => {
  it("вечер: с 19:00 до начала следующих суток", () => {
    expect(isEvening(new Date(2026, 9, 26, 18, 59), 4)).toBe(false);
    expect(isEvening(new Date(2026, 9, 26, 19, 0), 4)).toBe(true);
    expect(isEvening(new Date(2026, 9, 27, 2, 0), 4)).toBe(true);
    expect(isEvening(new Date(2026, 9, 27, 5, 0), 4)).toBe(false);
  });

  it("пустая запись", () => {
    expect(isBlank({ happened: " ", noticed: "", feeling: "", mood: null })).toBe(true);
    expect(isBlank({ happened: "", noticed: "", feeling: "", mood: 3 })).toBe(false);
  });
});

describe("ставки V0.3", () => {
  it("этапы и победы видны и сохраняются вместе с остальными", () => {
    const merged = mergeRates({ rates: { extra: { xp: 1, gold: 1 } } }, settings.rates);
    expect(merged["boss_defeat"]).toEqual({ xp: 60, gold: 25 });
    expect(merged["extra"]).toEqual({ xp: 1, gold: 1 });
  });
});

describe("доска и день с боссами", () => {
  it("босс и этапы не попадают в приказы дня, этапы не лежат на доске", () => {
    const quests = [quest({ id: 1 }), { ...boss, scheduledDate: today }, stage(2, 1)];
    expect(todayBoard(quests, today, 4).active.map((q) => q.id)).toEqual([1]);
    const map = questMap(quests, today, 4);
    expect(map.days[0]?.quests.map((q) => q.id)).toEqual([10, 1]);
    expect([...map.days.flatMap((d) => d.quests), ...map.backlog, ...map.later].some((q) => q.type === "stage")).toBe(false);
  });
});

describe("порядок этапов", () => {
  it("перетаскивание ставит этап на место целевого", () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    expect(reorder(items, 3, 1).map((i) => i.id)).toEqual([3, 1, 2]);
    expect(reorder(items, 1, 3).map((i) => i.id)).toEqual([2, 1, 3]);
    expect(reorder(items, 2, 2).map((i) => i.id)).toEqual([1, 2, 3]);
  });
});

describe("календарь серии", () => {
  it("заканчивается воскресеньем текущей недели и включает сегодня", () => {
    expect(calendarStart("2026-10-26", 8)).toBe("2026-09-07");
    expect(calendarStart("2026-10-25", 8)).toBe("2026-08-31");
    const last = addDays(calendarStart("2026-10-28", 8), 8 * 7 - 1);
    expect(last).toBe("2026-11-01");
  });
});

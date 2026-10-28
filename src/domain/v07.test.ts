import { describe, expect, it } from "vitest";

import { chronicleMarkdown } from "./chronicle";
import { character, day, quest, ritual, settings } from "./fixtures.test-helpers";
import { checkOut, currentStay, innDates, planCheckIn } from "./inn";
import { cleanLabel, labelsOf, stepsDoneByQuest, stepsOf } from "./quests";
import { reminderPlan } from "./reminder";
import { closePastDays, currentStreak } from "./streak";
import { questReward, stepsBonusPct } from "./rewards";
import { planCompleteQuest, planDayClose, type TurnContext } from "./turns";
import type { InnStay, LedgerEntry, QuestStep, Valor } from "./types";
import { blankValor, paidLeft, planMarkValor, planUndoValor, prepareValor, VALOR_DAILY_CAP, valorCounts, valorProblem } from "./valors";
import { planYesterday, yesterdayOffer } from "./yesterday";

const today = "2026-10-27";
const yesterday = "2026-10-26";
const now = new Date("2026-10-27T12:00:00.000Z");

function ctx(overrides: Partial<TurnContext> = {}): TurnContext {
  return {
    character: character(),
    settings,
    days: [day("2026-10-25", 1), day(yesterday, 0, false), day(today, 0, false)],
    today,
    now,
    gear: [],
    perks: new Set(),
    uid: () => "uid",
    inn: new Set<string>(),
    ...overrides,
  };
}

function stay(startDate: string, endDate: string): InnStay {
  return { id: 1, startDate, endDate, createdAt: "2026-10-20T00:00:00.000Z" };
}

describe("комната в таверне", () => {
  it("дни таверны без дел серию не рвут и не растят", () => {
    const inn = innDates([stay("2026-10-24", "2026-10-25")]);
    const days = [day("2026-10-22", 1), day("2026-10-23", 1), day("2026-10-24", 0), day("2026-10-25", 0), day(yesterday, 1)];
    expect(currentStreak(days, today, inn)).toBe(3);
    expect(currentStreak(days, today)).toBe(1);
  });

  it("день таверны не опускает ветер и не включает усталость, а дело в нём засчитывается", () => {
    const inn = innDates([stay("2026-10-25", yesterday)]);
    const days = [day("2026-10-24", 1), day("2026-10-25", 0, false), day(yesterday, 1, false)];
    const result = closePastDays(days, today, 2, null, settings.streakBonus, now.toISOString(), { inn });
    expect(result.windStep).toBe(2);
    expect(result.fatiguedSince).toBeNull();
    expect(currentStreak(result.days, today, inn)).toBe(2);
  });

  it("заселение сегодня снимает усталость, повторное и слишком долгое запрещены", () => {
    const outcome = planCheckIn(ctx({ character: character({ fatiguedSince: yesterday }) }), [], today, 5);
    expect(outcome.innStays).toEqual([{ uid: "uid", startDate: today, endDate: "2026-10-31" }]);
    expect(outcome.character.fatiguedSince).toBeNull();
    expect(outcome.ledger).toEqual([]);
    const tomorrow = planCheckIn(ctx({ character: character({ fatiguedSince: yesterday }) }), [], "2026-10-28", 1);
    expect(tomorrow.character.fatiguedSince).toBe(yesterday);
    expect(() => planCheckIn(ctx(), [stay(today, "2026-10-29")], today, 2)).toThrow();
    expect(() => planCheckIn(ctx(), [], today, 31)).toThrow();
    expect(() => planCheckIn(ctx(), [], "2026-10-30", 2)).toThrow();
  });

  it("вернуться раньше: начатая комната кончается вчера, будущая отменяется", () => {
    expect(checkOut(stay("2026-10-20", "2026-10-30"), today)).toEqual({ endDate: yesterday });
    expect(checkOut(stay(today, "2026-10-30"), today)).toBe("cancel");
    expect(checkOut(stay("2026-10-28", "2026-10-30"), today)).toBe("cancel");
    expect(currentStay([stay("2026-10-01", "2026-10-05"), { ...stay("2026-10-28", "2026-10-30"), id: 2 }], today)?.id).toBe(2);
  });

  it("напоминание молчит в дни таверны", () => {
    const on = { ...settings, reminder: { enabled: true, hour: 19, quietWeekdays: [] } };
    const morning = new Date(2026, 9, 27, 8, 0);
    const inn = innDates([stay(today, "2026-10-28")]);
    expect(reminderPlan(morning, today, on, [], inn).map((r) => r.gameDate)).not.toContain(today);
    expect(reminderPlan(morning, today, on, [], inn).map((r) => r.gameDate)).not.toContain("2026-10-28");
    expect(reminderPlan(morning, today, on, []).map((r) => r.gameDate)).toContain(today);
  });
});

describe("что было вчера", () => {
  const rituals = [ritual(), ritual({ id: 2, title: "Тренировка с мечом", schedule: "weekdays", weekdaysMask: 0b10 })];
  const quests = [quest({ id: 5, scheduledDate: yesterday }), quest({ id: 6, scheduledDate: today }), quest({ id: 7, type: "boss", scheduledDate: yesterday })];

  it("предлагает ритуалы по вчерашнему расписанию и квесты на вчера", () => {
    const offer = yesterdayOffer(ctx().days, today, new Set(), rituals, [], quests, settings);
    expect(offer?.rituals.map((r) => r.id)).toEqual([1]);
    expect(offer?.quests.map((q) => q.id)).toEqual([5]);
  });

  it("не предлагает, если вчера уже было дело, таверна, отметка или долгий перерыв", () => {
    const busy = [day("2026-10-25", 1), day(yesterday, 1, false)];
    expect(yesterdayOffer(busy, today, new Set(), rituals, [], quests, settings)).toBeNull();
    expect(yesterdayOffer(ctx().days, today, new Set([yesterday]), rituals, [], quests, settings)).toBeNull();
    const marked = [{ ritualId: 1, gameDate: yesterday, completedAt: "" }];
    expect(yesterdayOffer(ctx().days, today, new Set(), rituals, marked, [], settings)).toBeNull();
    const long = [day("2026-10-20", 1), day("2026-10-21", 0), day("2026-10-22", 0), day(yesterday, 0, false)];
    expect(yesterdayOffer(long, today, new Set(), rituals, [], quests, settings)).toBeNull();
    expect(yesterdayOffer([day(yesterday, 0, false)], today, new Set(), rituals, [], quests, settings)).toBeNull();
  });

  it("пока карточка ждёт, вчерашние сутки остаются открытыми", () => {
    const plan = planDayClose(ctx({ days: [day("2026-10-25", 1), day(yesterday, 0, false)] }), true);
    expect(plan?.outcome.days.map((d) => d.gameDate)).toEqual([today]);
    expect(plan?.outcome.character.fatiguedSince).toBeNull();
  });

  it("отмеченное пишется вчерашней датой, серия идёт дальше", () => {
    const base = ctx();
    const offer = yesterdayOffer(base.days, today, new Set(), rituals, [], quests, settings);
    if (!offer) throw new Error("нет карточки");
    const outcome = planYesterday(base, offer, offer.rituals, offer.quests);
    expect(outcome.ledger.map((e) => [e.sourceType, e.sourceId, e.gameDate])).toEqual([
      ["ritual", 1, yesterday],
      ["quest", 5, yesterday],
    ]);
    expect(outcome.rituals).toEqual([{ ritualId: 1, gameDate: yesterday, done: true }]);
    expect(outcome.quests.map((q) => [q.id, q.status])).toEqual([[5, "done"]]);
    expect(outcome.gear).toEqual([]);
    const closed = outcome.days.find((d) => d.gameDate === yesterday);
    expect(closed?.deedsCount).toBe(2);
    expect(closed?.closedAt).not.toBeNull();
    expect(outcome.character).toMatchObject({ xp: 15, gold: 5, streakCurrent: 2, fatiguedSince: null });
  });

  it("«нечего отмечать» закрывает сутки как обычно", () => {
    const base = ctx({ character: character({ windStep: 2 }) });
    const offer = yesterdayOffer(base.days, today, new Set(), rituals, [], quests, settings);
    if (!offer) throw new Error("нет карточки");
    const outcome = planYesterday(base, offer, [], []);
    expect(outcome.ledger).toEqual([]);
    expect(outcome.character).toMatchObject({ windStep: 1, fatiguedSince: yesterday, streakCurrent: 0 });
  });
});

describe("чек-лист и метки", () => {
  function step(id: number, questId: number, done: boolean, sortOrder = id): QuestStep {
    return { id, questId, title: `пункт ${String(id)}`, doneAt: done ? "2026-10-27T08:00:00.000Z" : null, sortOrder };
  }

  it("каждые три отмеченных пункта дают +10 %, не больше +30 %", () => {
    expect([0, 2, 3, 5, 6, 9, 10].map(stepsBonusPct)).toEqual([0, 0, 10, 10, 20, 30, 30]);
    const main = quest({ type: "main", difficulty: 2 });
    expect(questReward(main, settings, 0)).toMatchObject({ xp: 60, gold: 20 });
    expect(questReward(main, settings, 0, 6)).toMatchObject({ xp: 72, gold: 24 });
  });

  it("выполнение квеста учитывает отмеченные пункты", () => {
    const result = planCompleteQuest(ctx(), quest({ scheduledDate: today }), 3);
    expect(result.reward).toMatchObject({ xp: 11, gold: 3 });
    expect(result.outcome.ledger[0]?.xpDelta).toBe(11);
  });

  it("пункты по порядку, отмеченные считаются по квестам", () => {
    const steps = [step(3, 1, true, 0), step(1, 1, false, 1), step(2, 2, true)];
    expect(stepsOf(steps, 1).map((s) => s.id)).toEqual([3, 1]);
    expect([...stepsDoneByQuest(steps)]).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  it("метки без повторов по алфавиту, пустая метка значит «без метки»", () => {
    const quests = [quest({ label: "Работа" }), quest({ id: 2, label: "Дом" }), quest({ id: 3, label: "Работа" }), quest({ id: 4 })];
    expect(labelsOf(quests)).toEqual(["Дом", "Работа"]);
    expect(cleanLabel("  ")).toBeNull();
    expect(cleanLabel(" Учёба ")).toBe("Учёба");
    expect(cleanLabel("я".repeat(50))).toHaveLength(40);
  });
});

describe("выгрузка хроники", () => {
  it("пустые записи пропускаются, дни идут по порядку", () => {
    const entry = (gameDate: string, happened: string, mood: number | null = null) => ({ gameDate, happened, noticed: "", feeling: "", mood, updatedAt: "" });
    const md = chronicleMarkdown([entry(today, "Сдал отчёт", 1), entry("2026-10-01", "  "), entry(yesterday, "Дорога")], "Илья", ["хмуро", "ясно"], (d) => d.slice(5));
    expect(md).toBe("# Хроника героя Илья\n\n## 10-26 2026\n\n**Что произошло.** Дорога\n\n## 10-27 2026\n\n*Настроение: ясно*\n\n**Что произошло.** Сдал отчёт\n");
  });
});

describe("доблести", () => {
  const valor: Valor = { id: 3, title: "Глоток из родника", realName: "выпил воды", attribute: "strength", sortOrder: 0, createdAt: "", archivedAt: null };

  function entry(id: number, over: Partial<LedgerEntry> = {}): LedgerEntry {
    return {
      id,
      occurredAt: "",
      gameDate: today,
      sourceType: "valor",
      sourceId: valor.id,
      xpDelta: 2,
      goldDelta: 1,
      attribute: "strength",
      attributeDelta: 1,
      revertsId: null,
      note: valor.title,
      ...over,
    };
  }

  it("отметка даёт малую награду, не дело дня и не меняет серию и усталость", () => {
    const base = ctx({ character: character({ fatiguedSince: yesterday, streakCurrent: 4 }) });
    const result = planMarkValor(base, valor, []);
    expect(result.reward).toMatchObject({ xp: 2, gold: 1, attribute: "strength", attributeDelta: 1 });
    expect(result.outcome.days).toEqual([]);
    expect(result.outcome.gear).toEqual([]);
    expect(result.outcome.character).toMatchObject({ xp: 2, gold: 1, streakCurrent: 4, fatiguedSince: yesterday });
    expect(result.outcome.ledger).toMatchObject([{ sourceType: "valor", sourceId: 3, xpDelta: 2, goldDelta: 1 }]);
  });

  it("после пятой оплаченной отметки за сутки награды нет, но запись в журнале остаётся", () => {
    const paid = [1, 2, 3, 4, 5].map((id) => entry(id));
    expect(paidLeft(paid.slice(0, 4), today)).toBe(1);
    expect(paidLeft(paid, today)).toBe(0);
    const sixth = planMarkValor(ctx(), valor, paid);
    expect(sixth.reward).toEqual({ xp: 0, gold: 0, attribute: null, attributeDelta: 0 });
    expect(sixth.outcome.ledger).toHaveLength(1);
    expect(sixth.outcome.character).toMatchObject({ xp: 0, gold: 0 });
    expect(paidLeft([entry(9, { gameDate: yesterday })], today)).toBe(VALOR_DAILY_CAP);
  });

  it("отмена откатывает последнюю отметку обратной записью и освобождает место под награду", () => {
    const marks = [entry(1), entry(2)];
    const undone = planUndoValor(ctx({ character: character({ xp: 4, gold: 2 }) }), valor, marks);
    expect(undone.ledger).toMatchObject([{ sourceType: "revert", sourceId: 3, revertsId: 2, xpDelta: -2, goldDelta: -1, note: "valor" }]);
    expect(undone.character).toMatchObject({ xp: 2, gold: 1 });
    expect(paidLeft([...marks, entry(3, { sourceType: "revert", revertsId: 2, xpDelta: -2, goldDelta: -1, attributeDelta: -1 })], today)).toBe(VALOR_DAILY_CAP - 1);
    expect(() => planUndoValor(ctx(), valor, [])).toThrow();
  });

  it("счёт за сегодня и за неделю берётся из журнала без отменённых", () => {
    const ledger = [entry(1), entry(2), entry(3, { gameDate: "2026-10-26" }), entry(4, { sourceType: "revert", revertsId: 2, xpDelta: -2, goldDelta: -1, attributeDelta: -1 })];
    const [count] = valorCounts([valor], ledger, today);
    expect(count).toMatchObject({ today: 1, week: 2 });
  });

  it("название обязательно, пробелы обрезаются, пустое «в жизни это» становится null", () => {
    expect(valorProblem({ ...blankValor(0), title: "  " })).not.toBeNull();
    expect(prepareValor({ ...blankValor(0), title: "  Страница  ", realName: "  " })).toMatchObject({ title: "Страница", realName: null });
  });
});

import { applyReward, stateOf } from "./character";
import { absenceBefore } from "./journey";
import { isTask } from "./quests";
import { questReward, ritualReward } from "./rewards";
import { isDue } from "./rituals";
import { closePastDays, isSuccess } from "./streak";
import { addDays } from "./time";
import { ledgerFor, NOTHING, withStreak, type TurnContext } from "./turns";
import type { Day, GameDate, NewLedgerEntry, Outcome, Quest, Ritual, RitualCompletion, Settings } from "./types";

/** Что можно отметить задним числом: ритуалы по вчерашнему расписанию и квесты, взятые на вчера. */
export interface YesterdayOffer {
  date: GameDate;
  rituals: Ritual[];
  quests: Quest[];
}

/**
 * Карточка «Что было вчера?». Появляется, пока вчерашние сутки не закрыты и прошли без дел, отдыха и таверны,
 * а перерыв короче порога карточки «С возвращением». Новичок без единого прошлого дела её не видит.
 */
export function yesterdayOffer(
  days: readonly Day[],
  today: GameDate,
  inn: ReadonlySet<GameDate>,
  rituals: readonly Ritual[],
  completions: readonly RitualCompletion[],
  quests: readonly Quest[],
  settings: Settings,
): YesterdayOffer | null {
  const date = addDays(today, -1);
  const row = days.find((d) => d.gameDate === date);
  if (row?.closedAt || isSuccess(row) || inn.has(date)) return null;
  const absence = absenceBefore(days, today);
  if (!absence || absence.days >= settings.journey.returnAfterDays) return null;
  const due = rituals.filter(
    (r) =>
      r.archivedAt === null &&
      r.createdAt.slice(0, 10) <= date &&
      isDue(r, completions, date) &&
      !completions.some((c) => c.ritualId === r.id && c.gameDate === date),
  );
  const taken = quests.filter((q) => isTask(q) && q.status === "active" && q.archivedAt === null && q.scheduledDate === date);
  if (due.length === 0 && taken.length === 0) return null;
  return { date, rituals: due, quests: taken };
}

/**
 * Записывает отмеченное за вчера одним ходом и закрывает вчерашние сутки.
 * Награда как обычно, записи журнала и отметки ритуалов вчерашней датой. Находок за прошлое нет.
 * Пустой выбор просто закрывает сутки: «нечего отмечать».
 */
export function planYesterday(
  ctx: TurnContext,
  offer: YesterdayOffer,
  rituals: readonly Ritual[],
  quests: readonly Quest[],
  stepsDone: ReadonlyMap<number, number> = new Map(),
): Outcome {
  const back: TurnContext = { ...ctx, today: offer.date };
  let state = stateOf(ctx.character);
  const ledger: NewLedgerEntry[] = [];
  for (const ritual of rituals) {
    const reward = ritualReward(ritual, ctx.settings, ctx.character.windStep);
    state = applyReward(state, reward, 1, ctx.settings.levelCurve);
    ledger.push(ledgerFor(back, "ritual", ritual.id, reward));
  }
  for (const quest of quests) {
    const reward = questReward(quest, ctx.settings, ctx.character.windStep, stepsDone.get(quest.id) ?? 0);
    state = applyReward(state, reward, 1, ctx.settings.levelCurve);
    ledger.push(ledgerFor(back, "quest", quest.id, reward));
  }
  const deeds = rituals.length + quests.length;
  const before = ctx.days.find((d) => d.gameDate === offer.date) ?? { gameDate: offer.date, kind: "normal" as const, deedsCount: 0, closedAt: null };
  const row: Day = { ...before, deedsCount: before.deedsCount + deeds };
  const withRow = [...ctx.days.filter((d) => d.gameDate !== offer.date), row];
  const fatigue = deeds > 0 ? null : state.fatiguedSince;
  const closing = closePastDays(withRow, ctx.today, state.windStep, fatigue, ctx.settings.streakBonus, ctx.now.toISOString(), {
    guardSingleMiss: ctx.perks.has("wind_guard"),
    inn: ctx.inn,
  });
  const character = withStreak({ ...state, windStep: closing.windStep, fatiguedSince: closing.fatiguedSince }, closing.days, ctx.today, ctx.inn);
  const completedAt = ctx.now.toISOString();
  return {
    ...NOTHING,
    quests: quests.map((q) => ({ id: q.id, status: "done", completedAt })),
    rituals: rituals.map((r) => ({ ritualId: r.id, gameDate: offer.date, done: true })),
    ledger,
    days: closing.changed,
    character,
  };
}

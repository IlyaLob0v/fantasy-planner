import { applyReward, stateOf } from "./character";
import { weekStart } from "./rituals";
import { NOTHING, type DeedResult, type TurnContext } from "./turns";
import type { GameDate, LedgerEntry, NewLedgerEntry, Outcome, Reward, Valor, ValorFields } from "./types";

/** Награда начисляется за первые пять отметок доблестей в сутки, дальше растёт только счёт. */
export const VALOR_DAILY_CAP = 5;

const TITLE_MAX = 60;

export function blankValor(sortOrder: number): ValorFields {
  return { title: "", realName: null, attribute: "strength", sortOrder };
}

export function valorFieldsOf(v: Valor): ValorFields {
  return { title: v.title, realName: v.realName, attribute: v.attribute, sortOrder: v.sortOrder };
}

export function valorProblem(fields: ValorFields): string | null {
  if (fields.title.trim() === "") return "Назови доблесть";
  return null;
}

export function prepareValor(fields: ValorFields): ValorFields {
  const realName = fields.realName?.trim() ?? "";
  return { ...fields, title: fields.title.trim().slice(0, TITLE_MAX), realName: realName === "" ? null : realName.slice(0, TITLE_MAX) };
}

/** Живые отметки: не отменённые и не сами отмены. */
function marks(ledger: readonly LedgerEntry[]): LedgerEntry[] {
  const reverted = new Set(ledger.map((e) => e.revertsId).filter((id): id is number => id !== null));
  return ledger.filter((e) => e.sourceType === "valor" && !reverted.has(e.id));
}

/** Оплаченная отметка всегда несёт +1 к атрибуту, неоплаченная (сверх потолка) ничего не несёт. */
function isPaid(entry: LedgerEntry): boolean {
  return entry.attributeDelta > 0;
}

export interface ValorCount {
  valor: Valor;
  today: number;
  week: number;
}

/** Счёт за сегодня и за неделю по каждой доблести; считается только из журнала. */
export function valorCounts(valors: readonly Valor[], ledger: readonly LedgerEntry[], today: GameDate): ValorCount[] {
  const from = weekStart(today);
  const live = marks(ledger).filter((e) => e.gameDate >= from && e.gameDate <= today);
  return valors.map((valor) => {
    const own = live.filter((e) => e.sourceId === valor.id);
    return { valor, today: own.filter((e) => e.gameDate === today).length, week: own.length };
  });
}

/** Сколько отметок сегодня ещё принесут награду. */
export function paidLeft(ledger: readonly LedgerEntry[], today: GameDate): number {
  const paid = marks(ledger).filter((e) => e.gameDate === today && isPaid(e)).length;
  return Math.max(0, VALOR_DAILY_CAP - paid);
}

/**
 * Отметка доблести: малая награда без находки, без «дела дня» и без влияния на серию и усталость.
 * `todayLedger` нужен, чтобы знать, сколько отметок за сутки уже оплачено.
 */
export function planMarkValor(ctx: TurnContext, valor: Valor, todayLedger: readonly LedgerEntry[]): DeedResult {
  const paid = paidLeft(todayLedger, ctx.today) > 0;
  const rate = ctx.settings.rates.valor;
  const reward: Reward = paid
    ? { xp: rate.xp, gold: rate.gold, attribute: valor.attribute, attributeDelta: 1 }
    : { xp: 0, gold: 0, attribute: null, attributeDelta: 0 };
  const before = stateOf(ctx.character);
  const character = applyReward(before, reward, 1, ctx.settings.levelCurve);
  const entry: NewLedgerEntry = {
    gameDate: ctx.today,
    sourceType: "valor",
    sourceId: valor.id,
    xpDelta: reward.xp,
    goldDelta: reward.gold,
    attribute: reward.attribute,
    attributeDelta: reward.attributeDelta,
    revertsId: null,
    note: valor.title,
  };
  const outcome: Outcome = { ...NOTHING, ledger: [entry], days: [], character };
  return { outcome, reward, levelUp: character.level > before.level ? character.level : null, revived: false, victory: null, find: null };
}

/** Отмена последней сегодняшней отметки этой доблести обратной записью журнала. */
export function planUndoValor(ctx: TurnContext, valor: Valor, todayLedger: readonly LedgerEntry[]): Outcome {
  const last = marks(todayLedger)
    .filter((e) => e.gameDate === ctx.today && e.sourceId === valor.id)
    .sort((a, b) => b.id - a.id)[0];
  if (!last) {
    throw new Error("Сегодня эта доблесть не отмечена");
  }
  const reward: Reward = { xp: last.xpDelta, gold: last.goldDelta, attribute: last.attribute, attributeDelta: last.attributeDelta };
  const character = applyReward(stateOf(ctx.character), reward, -1, ctx.settings.levelCurve);
  const entry: NewLedgerEntry = {
    gameDate: ctx.today,
    sourceType: "revert",
    sourceId: valor.id,
    xpDelta: -last.xpDelta,
    goldDelta: -last.goldDelta,
    attribute: last.attribute,
    attributeDelta: -last.attributeDelta,
    revertsId: last.id,
    note: "valor",
  };
  return { ...NOTHING, ledger: [entry], days: [], character };
}

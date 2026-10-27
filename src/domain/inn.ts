import { stateOf } from "./character";
import { addDays, daysBetween } from "./time";
import { NOTHING, withStreak, type TurnContext } from "./turns";
import type { GameDate, InnStay, Outcome } from "./types";

/** Самая долгая комната в таверне, в сутках. */
export const INN_MAX_NIGHTS = 30;

/** Все даты комнат в таверне. Комната короткая, поэтому разворачивается в набор дат целиком. */
export function innDates(stays: readonly InnStay[]): Set<GameDate> {
  const dates = new Set<GameDate>();
  for (const stay of stays) {
    for (let d = stay.startDate; d <= stay.endDate; d = addDays(d, 1)) {
      dates.add(d);
    }
  }
  return dates;
}

/** Комната, которая идёт сейчас или начнётся позже. Одновременно бывает только одна. */
export function currentStay(stays: readonly InnStay[], today: GameDate): InnStay | null {
  return stays.find((s) => s.endDate >= today) ?? null;
}

/** Сколько суток длится комната, включая первую и последнюю. */
export function stayNights(stay: Pick<InnStay, "startDate" | "endDate">): number {
  return daysBetween(stay.startDate, stay.endDate) + 1;
}

/**
 * Заселение в таверну: бесплатно, с сегодня или с завтра, от 1 до 30 суток.
 * С сегодняшнего дня снимает усталость: это осознанный отдых.
 */
export function planCheckIn(ctx: TurnContext, stays: readonly InnStay[], startDate: GameDate, nights: number): Outcome {
  if (currentStay(stays, ctx.today)) {
    throw new Error("Комната в таверне уже снята");
  }
  if (startDate !== ctx.today && startDate !== addDays(ctx.today, 1)) {
    throw new Error("Заселиться можно сегодня или завтра");
  }
  if (!Number.isInteger(nights) || nights < 1 || nights > INN_MAX_NIGHTS) {
    throw new Error(`Комнату сдают от 1 до ${String(INN_MAX_NIGHTS)} суток`);
  }
  const stay = { uid: ctx.uid(), startDate, endDate: addDays(startDate, nights - 1) };
  const inn = new Set([...ctx.inn, ...innDates([{ id: 0, createdAt: "", ...stay }])]);
  const before = stateOf(ctx.character);
  const rested = startDate === ctx.today ? { ...before, fatiguedSince: null } : before;
  return { ...NOTHING, ledger: [], days: [], innStays: [stay], character: withStreak(rested, ctx.days, ctx.today, inn) };
}

/**
 * Возвращение из таверны раньше срока. Начавшаяся комната заканчивается вчера, чтобы сегодня
 * снова был обычным днём; не начавшаяся (или начатая сегодня) отменяется целиком.
 */
export function checkOut(stay: InnStay, today: GameDate): { endDate: GameDate } | "cancel" {
  return stay.startDate >= today ? "cancel" : { endDate: addDays(today, -1) };
}

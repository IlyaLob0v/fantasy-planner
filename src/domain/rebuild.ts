import { levelProgress, titleForLevel } from "./levels";
import { weekStart } from "./rituals";
import { closePastDays, currentStreak, isSuccess } from "./streak";
import { addDays } from "./time";
import { NOTHING, type TurnContext } from "./turns";
import type { Day, GameDate, LedgerEntry, Outcome } from "./types";

/** Источники, которые считаются делом дня. Победа над боссом идёт вместе со своим этапом и делом не считается. */
const DEEDS: ReadonlySet<LedgerEntry["sourceType"]> = new Set(["quest", "ritual", "rest_action"]);

/** Записи без отмен и без отменённых. */
function live(ledger: readonly LedgerEntry[]): LedgerEntry[] {
  const reverted = new Set(ledger.map((e) => e.revertsId).filter((id): id is number => id !== null));
  return ledger.filter((e) => e.sourceType !== "revert" && !reverted.has(e.id));
}

/**
 * Одно и то же достижение или одна и та же цель недели, заработанные без сети на двух устройствах,
 * пришли двумя записями. В счёт идёт первая: золото за одну награду не удваивается.
 */
function repeats(ledger: readonly LedgerEntry[]): Set<number> {
  const seen = new Set<string>();
  const extra = new Set<number>();
  const ordered = [...ledger].sort((a, b) => (a.occurredAt < b.occurredAt ? -1 : a.occurredAt > b.occurredAt ? 1 : a.id - b.id));
  for (const e of ordered) {
    const key =
      e.sourceType === "achievement" ? `achievement:${e.note ?? ""}` : e.sourceType === "week_chest" ? `week:${weekStart(e.gameDate)}:${e.note ?? ""}` : null;
    if (key === null) continue;
    if (seen.has(key)) extra.add(e.id);
    seen.add(key);
  }
  return extra;
}

function longestRun(days: readonly Day[]): number {
  const success = new Set(days.filter(isSuccess).map((d) => d.gameDate));
  let best = 0;
  for (const date of success) {
    if (success.has(addDays(date, -1))) continue;
    let length = 0;
    let cursor = date;
    while (success.has(cursor)) {
      length += 1;
      cursor = addDays(cursor, 1);
    }
    best = Math.max(best, length);
  }
  return best;
}

/**
 * Пересчёт героя после сверки: кэш персонажа и дела дней снова выводятся из журнала, пришедшего со всех устройств.
 * Ничего не отнимается сверх журнала: золото, потраченное дважды без сети, прощается до нуля.
 * «Попутный ветер» и усталость получаются повтором подведения итогов по всем дням.
 */
export function planRebuild(ctx: TurnContext, ledger: readonly LedgerEntry[], days: readonly Day[]): Outcome {
  const extra = repeats(ledger);
  const counted = ledger.filter((e) => !extra.has(e.id));
  const sum = (pick: (e: LedgerEntry) => number) => counted.reduce((total, e) => total + pick(e), 0);
  const attribute = (name: LedgerEntry["attribute"]) => Math.max(0, sum((e) => (e.attribute === name ? e.attributeDelta : 0)));
  const xp = Math.max(0, sum((e) => e.xpDelta));
  const { level } = levelProgress(xp, ctx.settings.levelCurve);

  const deeds = new Map<GameDate, number>();
  for (const e of live(counted)) {
    if (DEEDS.has(e.sourceType)) deeds.set(e.gameDate, (deeds.get(e.gameDate) ?? 0) + 1);
  }
  const byDate = new Map(days.map((d) => [d.gameDate, d]));
  const dates = [...new Set([...byDate.keys(), ...deeds.keys()])].filter((d) => d <= ctx.today).sort();
  const closedAt = ctx.now.toISOString();
  const rows: Day[] = dates.map((date) => {
    const existing = byDate.get(date);
    return {
      gameDate: date,
      kind: existing?.kind ?? "normal",
      deedsCount: deeds.get(date) ?? 0,
      closedAt: existing?.closedAt ?? (date < ctx.today ? closedAt : null),
    };
  });
  const future = days.filter((d) => d.gameDate > ctx.today);
  const changed = rows.filter((row) => {
    const before = byDate.get(row.gameDate);
    return !before || before.deedsCount !== row.deedsCount || before.closedAt !== row.closedAt;
  });

  const replay = closePastDays(
    rows.map((d) => ({ ...d, closedAt: null })),
    ctx.today,
    0,
    null,
    ctx.settings.streakBonus,
    closedAt,
    ctx.perks.has("wind_guard"),
  );
  const missed = replay.fatiguedSince;
  const revived =
    missed !== null && rows.some((d) => (d.gameDate > missed && d.deedsCount > 0) || (d.gameDate === ctx.today && d.kind === "rest"));
  const all = [...rows, ...future];
  const streak = currentStreak(all, ctx.today);

  return {
    ...NOTHING,
    ledger: [],
    days: changed,
    character: {
      title: titleForLevel(level),
      level,
      xp,
      gold: Math.max(0, sum((e) => e.goldDelta)),
      strength: attribute("strength"),
      intellect: attribute("intellect"),
      agility: attribute("agility"),
      streakCurrent: streak,
      streakBest: Math.max(ctx.character.streakBest, longestRun(all)),
      windStep: replay.windStep,
      fatiguedSince: revived ? null : missed,
      lootMisses: ctx.character.lootMisses,
    },
  };
}

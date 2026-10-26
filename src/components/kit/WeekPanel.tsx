import { useState } from "react";

import { daysWord } from "@/app/strings";
import { daysLeftInWeek, WEEK_GOALS, weekGoalDef } from "@/domain/week";
import type { WeekGoal } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { CheckIcon, ChestIcon, Coin } from "./icons";
import { OnceHint } from "./OnceHint";
import { Panel, PanelTitle } from "./Panel";

function GoalRow({ goal }: { goal: WeekGoal }) {
  const { weekFacts, weekOptions, swapWeekGoal, turnOffWeekGoal } = useGame();
  const [editing, setEditing] = useState(false);
  const def = weekGoalDef(goal.goalKey);
  if (!def) return null;
  const done = goal.state === "done";
  const progress = Math.min(goal.target, weekFacts[def.key]);
  const pct = Math.round((progress / goal.target) * 100);

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        {done && <CheckIcon className="h-4 w-4 shrink-0 self-center text-gold-bright" />}
        <span className={cn("min-w-0 flex-1 text-sm", done ? "text-gold-bright" : "text-parchment/85")}>{def.label(goal.target)}</span>
        <span className="text-xs tabular-nums text-parchment/55">
          {progress} / {goal.target}
        </span>
        {!done && (
          <button
            type="button"
            aria-expanded={editing}
            className="cursor-pointer text-xs text-parchment/40 hover:text-gold-bright"
            onClick={() => {
              setEditing((v) => !v);
            }}
          >
            {editing ? "Готово" : "Изменить"}
          </button>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ink-deep/70 ring-1 ring-gold/20">
        <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright transition-[width] duration-500" style={{ width: `${String(pct)}%` }} />
      </div>
      {editing && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {weekOptions.map((key) => (
            <button
              key={key}
              type="button"
              className="cursor-pointer rounded-[var(--radius-panel)] border border-parchment/15 px-2 py-1 text-xs text-parchment/75 hover:border-gold/50"
              onClick={() => {
                setEditing(false);
                swapWeekGoal(goal, key);
              }}
            >
              {WEEK_GOALS[key].name}
            </button>
          ))}
          <button
            type="button"
            className="cursor-pointer px-2 py-1 text-xs text-parchment/45 hover:text-parchment"
            onClick={() => {
              setEditing(false);
              turnOffWeekGoal(goal);
            }}
          >
            Убрать цель
          </button>
        </div>
      )}
    </li>
  );
}

/** Неделя гильдии в зале: три цели, подобранные по прошлым неделям, и сундук за все. */
export function WeekPanel() {
  const { weekGoals, today, settings } = useGame();
  const shown = weekGoals.filter((g) => g.state !== "off");
  if (shown.length === 0) return null;
  const left = daysLeftInWeek(today);
  const done = shown.filter((g) => g.state === "done").length;
  const chestReachable = shown.length === weekGoals.length && weekGoals.length >= 2;

  return (
    <Panel className="p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <PanelTitle className="text-xl">Неделя гильдии</PanelTitle>
        <span className="text-sm text-parchment/50">{left === 1 ? "последний день" : `ещё ${String(left)} ${daysWord(left)}`}</span>
      </div>
      <ul className="flex flex-col gap-3">
        {shown.map((g) => (
          <GoalRow key={g.id} goal={g} />
        ))}
      </ul>
      {chestReachable && (
        <p className={cn("mt-4 flex items-center gap-2 text-xs", done === shown.length ? "text-gold-bright" : "text-parchment/55")}>
          <ChestIcon className="h-4 w-4" />
          {done === shown.length ? "Сундук недели открыт" : `Сундук недели: ${String(done)} / ${String(shown.length)}`}
          <span className="ml-auto flex items-center gap-1 whitespace-nowrap tabular-nums">
            <Coin className="h-3.5 w-3.5" />+{settings.week.chestGold} и предмет
          </span>
        </p>
      )}
      <div className="mt-3">
        <OnceHint id="week">
          Цели подобраны по прошлым неделям, чуть выше обычного. За каждую {settings.week.goalGold} золота, за все сразу сундук недели. Не сложилось — цель
          просто уйдёт в воскресенье, без упрёков.
        </OnceHint>
      </div>
    </Panel>
  );
}

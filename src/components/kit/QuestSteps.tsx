import { useState, type SyntheticEvent } from "react";

import { stepsOf } from "@/domain/quests";
import { STEPS_BONUS_MAX_PCT, STEPS_BONUS_PCT, STEPS_PER_BONUS, stepsBonusPct } from "@/domain/rewards";
import type { Quest } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { Input } from "../ui/input";
import { CheckIcon } from "./icons";

/** Больше пунктов не бывает: крупное дело заводится боссом. Совпадает с проверкой в Rust. */
const MAX_STEPS = 10;

/**
 * Чек-лист главного или побочного квеста. Пункт сам награды не даёт, но каждые три отмеченных
 * добавляют квесту +10 % опыта и золота. В зале только отметки, в свитке ещё добавление и удаление.
 */
export function QuestSteps({ quest, editable = false }: { quest: Quest; editable?: boolean }) {
  const { steps, addStep, toggleStep, deleteStep, reportError } = useGame();
  const [title, setTitle] = useState("");
  const list = stepsOf(steps, quest.id);
  const open = quest.status === "active";
  const done = list.filter((s) => s.doneAt !== null).length;
  if (list.length === 0 && !editable) return null;

  const add = (e: SyntheticEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    addStep(quest.id, clean)
      .then(() => {
        setTitle("");
      })
      .catch(reportError);
  };
  const bonus = stepsBonusPct(done);
  const toNext = STEPS_PER_BONUS - (done % STEPS_PER_BONUS);

  return (
    <div className="flex flex-col gap-1.5">
      {list.length > 0 && (
        <p className="text-[11px] text-parchment/45">
          Чек-лист {done}/{list.length}
          {bonus > 0 && ` · +${String(bonus)} % к награде`}
          {open && bonus < STEPS_BONUS_MAX_PCT && done + toNext <= MAX_STEPS && ` · ещё ${String(toNext)} до +${String(bonus + STEPS_BONUS_PCT)} %`}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {list.map((s) => (
          <li key={s.id} className="group flex items-center gap-2">
            <button
              type="button"
              disabled={!open}
              aria-pressed={s.doneAt !== null}
              aria-label={s.doneAt !== null ? `Снять отметку: ${s.title}` : `Отметить: ${s.title}`}
              onClick={() => {
                toggleStep(s);
              }}
              className={cn(
                "grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-full ring-1 disabled:cursor-default",
                s.doneAt !== null ? "bg-gradient-to-br from-gold-bright to-gold text-wood ring-gold" : "bg-ink-deep/60 text-gold/70 ring-gold/40",
              )}
            >
              <CheckIcon className={cn("h-3 w-3", s.doneAt !== null ? "opacity-100" : "opacity-0")} />
            </button>
            <span className={cn("min-w-0 flex-1 truncate text-sm", s.doneAt !== null ? "text-parchment/50 line-through decoration-gold/50" : "text-parchment/85")}>
              {s.title}
            </span>
            {editable && open && (
              <button
                type="button"
                aria-label={`Убрать пункт: ${s.title}`}
                onClick={() => {
                  deleteStep(s);
                }}
                className="cursor-pointer px-1 text-xs text-parchment/35 hover:text-parchment"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {editable && open && list.length < MAX_STEPS && (
        <form onSubmit={add}>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="+ пункт чек-листа"
            className="h-8 text-sm"
            aria-label="Новый пункт чек-листа"
          />
        </form>
      )}
    </div>
  );
}

import { useRef } from "react";

import { xpText } from "@/app/strings";
import { ritualsForToday, type RitualToday } from "@/domain/rituals";
import { ritualReward } from "@/domain/rewards";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { CheckIcon, Coin } from "./icons";
import { Tooltip } from "../ui/tooltip";

function RitualSeal({ item }: { item: RitualToday }) {
  const { toggleRitual, settings, character } = useGame();
  const ref = useRef<HTMLButtonElement>(null);
  const { ritual, done, weekCount } = item;
  const reward = ritualReward(ritual, settings, character.windStep);
  const quota = ritual.schedule === "times_per_week" ? `${weekCount}/${ritual.timesPerWeek ?? 1}` : null;

  return (
    <li>
      <Tooltip content={done ? "Отметить как несделанное" : `${xpText(reward.xp)} · ${String(reward.gold)} зол.`}>
        <button
          ref={ref}
          type="button"
          aria-pressed={done}
          aria-label={done ? `Снять отметку: ${ritual.title}` : `Совершить: ${ritual.title}`}
          onClick={() => {
            toggleRitual(ritual, done, ref.current?.getBoundingClientRect() ?? null);
          }}
          className={cn(
            "group flex cursor-pointer items-center gap-2.5 rounded-full border py-1 pl-1 pr-3.5 text-left transition-colors",
            done ? "border-gold/50 bg-gold/15" : "border-parchment/15 bg-ink-deep/35 hover:border-gold/40",
          )}
        >
          <span
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-full ring-1 transition-colors",
              done ? "bg-gradient-to-br from-gold-bright to-gold text-wood ring-gold" : "bg-ink-deep/60 text-gold/70 ring-gold/40",
            )}
          >
            <CheckIcon className={cn("h-4 w-4 transition-opacity", done ? "opacity-100" : "opacity-0 group-hover:opacity-70")} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className={cn("text-sm", done ? "text-gold-bright" : "text-parchment")}>{ritual.title}</span>
            {(ritual.realName ?? quota) !== null && (
              <span className="text-xs text-parchment/60">
                {[ritual.realName, quota].filter((part) => part !== null).join(" · ")}
              </span>
            )}
          </span>
        </button>
      </Tooltip>
    </li>
  );
}

/** Ритуалы дня: отметка в один клик, повторный клик снимает её. */
export function RitualRow({ onEdit }: { onEdit: () => void }) {
  const { rituals, completions, today, settings } = useGame();
  const items = ritualsForToday(rituals, completions, today);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wider text-parchment/60">Ритуалы дня</p>
        <button type="button" onClick={onEdit} className="cursor-pointer text-xs text-gold/80 hover:text-gold-bright">
          {rituals.length === 0 ? "+ Ритуал" : "Ритуалы"}
        </button>
      </div>
      {items.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <RitualSeal key={item.ritual.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-parchment/60">
          {rituals.length === 0 ? (
            <>
              Обеты, которые повторяются: зарядка, чтение, прогулка. Каждый приносит {settings.rates.ritual.xp} опыта и{" "}
              <Coin className="inline h-3.5 w-3.5 align-[-2px]" /> {settings.rates.ritual.gold}.
            </>
          ) : (
            "На сегодня ритуалов нет."
          )}
        </p>
      )}
    </div>
  );
}

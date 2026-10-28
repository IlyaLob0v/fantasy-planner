import { useState } from "react";

import { humanDate, humanWeekday } from "@/domain/time";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { Button } from "../ui/button";
import { CheckIcon } from "./icons";
import { Panel, PanelTitle } from "./Panel";

function Mark({ title, note, checked, onToggle }: { title: string; note: string | null; checked: boolean; onToggle: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={checked}
        onClick={onToggle}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-panel)] border px-2 py-1.5 text-left transition-colors",
          checked ? "border-gold/50 bg-gold/15" : "border-parchment/10 bg-ink-deep/35 hover:border-gold/40",
        )}
      >
        <span
          className={cn(
            "grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1",
            checked ? "bg-gradient-to-br from-gold-bright to-gold text-wood ring-gold" : "bg-ink-deep/60 text-gold/70 ring-gold/40",
          )}
        >
          <CheckIcon className={cn("h-3.5 w-3.5", checked ? "opacity-100" : "opacity-0 group-hover:opacity-70")} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className={cn("text-sm", checked ? "text-gold-bright" : "text-parchment")}>{title}</span>
          {note && <span className="text-xs text-parchment/60">{note}</span>}
        </span>
      </button>
    </li>
  );
}

/**
 * «Что было вчера?»: забытые отметки за вчерашние сутки, пока они не закрыты.
 * Отмеченное записывается вчерашней датой, и серия не рвётся из-за забывчивости. Без упрёков.
 */
export function YesterdayCard() {
  const { yesterday, recordYesterday } = useGame();
  const [rituals, setRituals] = useState<ReadonlySet<number>>(new Set());
  const [quests, setQuests] = useState<ReadonlySet<number>>(new Set());
  if (!yesterday) return null;

  const toggle = (set: ReadonlySet<number>, id: number): Set<number> => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
  };
  const count = rituals.size + quests.size;

  return (
    <Panel className="p-5">
      <PanelTitle className="text-xl">Что было вчера?</PanelTitle>
      <p className="mt-1 text-sm text-parchment/65">
        {humanWeekday(yesterday.date)}, {humanDate(yesterday.date)}. Если что-то сделано, но не отмечено, отметь сейчас: награда и серия будут на месте.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {yesterday.rituals.map((r) => (
          <Mark
            key={`r${String(r.id)}`}
            title={r.title}
            note={r.realName ?? "ритуал"}
            checked={rituals.has(r.id)}
            onToggle={() => {
              setRituals((prev) => toggle(prev, r.id));
            }}
          />
        ))}
        {yesterday.quests.map((q) => (
          <Mark
            key={`q${String(q.id)}`}
            title={q.title}
            note="квест"
            checked={quests.has(q.id)}
            onToggle={() => {
              setQuests((prev) => toggle(prev, q.id));
            }}
          />
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            recordYesterday([], []);
          }}
        >
          Нечего отмечать
        </Button>
        <Button
          size="sm"
          disabled={count === 0}
          onClick={() => {
            recordYesterday(
              yesterday.rituals.filter((r) => rituals.has(r.id)),
              yesterday.quests.filter((q) => quests.has(q.id)),
            );
          }}
        >
          Записать{count > 0 ? ` (${String(count)})` : ""}
        </Button>
      </div>
    </Panel>
  );
}

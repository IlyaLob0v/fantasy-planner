import { useRef, useState } from "react";

import { activeBosses, bossHp, nextStage, stagesOf } from "@/domain/bosses";
import { isOverdue } from "@/domain/quests";
import { humanDate } from "@/domain/time";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { HpBar } from "./HpBar";
import { Panel, PanelTitle } from "./Panel";
import { Ribbon } from "./Ribbon";
import { Seal } from "./Seal";

/** Активный босс на главном экране: полоса HP и ближайший этап, по которому можно ударить. */
export function BossCard({ onOpenBoard }: { onOpenBoard: () => void }) {
  const { quests, today, completeQuest } = useGame();
  const bosses = activeBosses(quests);
  const [index, setIndex] = useState(0);
  const sealRef = useRef<HTMLButtonElement>(null);
  const boss = bosses[index % Math.max(1, bosses.length)];
  if (!boss) return null;

  const stages = stagesOf(quests, boss.id);
  const hp = bossHp(stages);
  const next = nextStage(stages);

  return (
    <Panel className="flex flex-col gap-3 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-parchment/60">Босс</p>
          <PanelTitle className="truncate">{boss.title}</PanelTitle>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm text-parchment/65">
          {boss.dueDate &&
            (isOverdue(boss, today) ? <Ribbon>Срок вышел</Ribbon> : <span>до {humanDate(boss.dueDate)}</span>)}
          {bosses.length > 1 && (
            <button
              type="button"
              className="cursor-pointer rounded px-1.5 text-parchment/70 hover:text-parchment"
              aria-label="Следующий босс"
              onClick={() => {
                setIndex((i) => (i + 1) % bosses.length);
              }}
            >
              {(index % bosses.length) + 1}/{bosses.length} ›
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <HpBar hp={hp} className="flex-1" />
        <span className="shrink-0 font-display text-lg tabular-nums text-parchment/80">
          {hp.current}/{hp.max}
        </span>
      </div>
      {next ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-parchment/10 bg-ink-deep/35 px-3 py-2.5">
          <Seal
            ref={sealRef}
            questType="stage"
            done={false}
            aria-label={`Пройти этап: ${next.title}`}
            onClick={() => {
              completeQuest(next, sealRef.current?.getBoundingClientRect() ?? null);
            }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] text-parchment">{next.title}</p>
            <p className="text-xs text-parchment/65">Следующий этап · урон {next.damage}</p>
          </div>
          <ol className="flex shrink-0 gap-1" aria-label="Этапы">
            {stages.map((s) => (
              <li
                key={s.id}
                title={s.title}
                className={cn("h-2 w-2 rounded-full", s.status === "done" ? "bg-gold" : s.id === next.id ? "bg-parchment/70" : "bg-parchment/20")}
              />
            ))}
          </ol>
        </div>
      ) : (
        <p className="text-sm text-parchment/65">
          У босса пока нет этапов.{" "}
          <button type="button" className="cursor-pointer text-gold/80 hover:text-gold-bright" onClick={onOpenBoard}>
            Разбить на доске
          </button>
        </p>
      )}
    </Panel>
  );
}

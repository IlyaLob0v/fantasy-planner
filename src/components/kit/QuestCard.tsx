import { useRef } from "react";

import { ATTRIBUTE_LABEL, QUEST_TYPE_LABEL, xpText } from "@/app/strings";
import { isOverdue, stepsOf } from "@/domain/quests";
import { questReward } from "@/domain/rewards";
import { humanDate } from "@/domain/time";
import type { Quest } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { ATTRIBUTE_ICON, Coin } from "./icons";
import { QuestSteps } from "./QuestSteps";
import { Ribbon } from "./Ribbon";
import { Seal } from "./Seal";

/** Квест на сегодня: печать слева выполняет его, повторное нажатие на сломанную печать отменяет. */
export function QuestCard({ quest }: { quest: Quest }) {
  const { today, settings, character, steps, completeQuest, undoQuest } = useGame();
  const sealRef = useRef<HTMLButtonElement>(null);
  const done = quest.status === "done";
  const Icon = ATTRIBUTE_ICON[quest.attribute];
  const stepsDone = stepsOf(steps, quest.id).filter((s) => s.doneAt !== null).length;
  const reward = questReward(quest, settings, character.windStep, stepsDone);

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-panel)] border border-parchment/10 bg-ink-deep/35 px-3 py-2.5 transition-colors",
        done ? "opacity-60" : "hover:border-gold/30 hover:bg-ink-deep/50",
      )}
    >
      <Seal
        ref={sealRef}
        questType={quest.type}
        done={done}
        aria-label={done ? `Отменить: ${quest.title}` : `Выполнить: ${quest.title}`}
        onClick={() => {
          if (done) {
            undoQuest(quest);
          } else {
            completeQuest(quest, sealRef.current?.getBoundingClientRect() ?? null);
          }
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("truncate text-[15px] text-parchment", done && "line-through decoration-gold/60")}>{quest.title}</p>
          {isOverdue(quest, today) && quest.dueDate && <Ribbon>Срок вышел {humanDate(quest.dueDate)}</Ribbon>}
        </div>
        <p className="flex flex-wrap items-center gap-x-1.5 whitespace-nowrap text-xs text-parchment/65">
          <span>{QUEST_TYPE_LABEL[quest.type]}</span>
          <span>·</span>
          <Icon className="h-3.5 w-3.5" />
          <span>{ATTRIBUTE_LABEL[quest.attribute]}</span>
          {quest.dueDate && !isOverdue(quest, today) && <span>· до {humanDate(quest.dueDate)}</span>}
          {quest.label && <span>· {quest.label}</span>}
        </p>
        <div className="mt-1.5 empty:hidden">
          <QuestSteps quest={quest} />
        </div>
      </div>
      {!done && (
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-xs text-parchment/70 md:flex-row md:items-center md:gap-2">
          <span>{xpText(reward.xp)}</span>
          <span className="flex items-center gap-1">
            <Coin className="h-3.5 w-3.5" />
            {reward.gold}
          </span>
        </div>
      )}
    </li>
  );
}

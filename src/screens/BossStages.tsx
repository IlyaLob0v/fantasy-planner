import { useRef, useState, type SyntheticEvent } from "react";

import { CloseIcon } from "@/components/kit/icons";
import { HpBar } from "@/components/kit/HpBar";
import { Seal } from "@/components/kit/Seal";
import { Input } from "@/components/ui/input";
import { bossHp, stagesOf } from "@/domain/bosses";
import { fieldsOf, reorder } from "@/domain/quests";
import type { Quest } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

const label = "flex flex-col gap-1 text-xs text-parchment/70";

function clampDamage(raw: string): number | null {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n >= 1 && n <= 10 ? n : null;
}

function StageRow({
  stage,
  onDragStart,
  onDropOn,
}: {
  stage: Quest;
  onDragStart: () => void;
  onDropOn: () => void;
}) {
  const { updateQuest, archiveQuest, completeQuest, undoQuest } = useGame();
  const sealRef = useRef<HTMLButtonElement>(null);
  const [title, setTitle] = useState(stage.title);
  const [damage, setDamage] = useState(String(stage.damage));
  const [over, setOver] = useState(false);
  const done = stage.status === "done";

  const save = () => {
    const clean = title.trim();
    const hit = clampDamage(damage);
    if (!clean || hit === null) {
      setTitle(stage.title);
      setDamage(String(stage.damage));
      return;
    }
    if (clean !== stage.title || hit !== stage.damage) {
      updateQuest(stage.id, { ...fieldsOf(stage), title: clean, damage: hit });
    }
  };

  return (
    <li
      draggable={!done}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(stage.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => {
        setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDropOn();
      }}
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-panel)] border bg-ink-deep/35 px-2 py-1.5",
        over ? "border-gold/60" : "border-parchment/10",
        !done && "cursor-grab",
      )}
    >
      <Seal
        ref={sealRef}
        questType="stage"
        done={done}
        className="h-7 w-7 shrink-0"
        aria-label={done ? `Отменить этап: ${stage.title}` : `Пройти этап: ${stage.title}`}
        onClick={() => {
          if (done) undoQuest(stage);
          else completeQuest(stage, sealRef.current?.getBoundingClientRect() ?? null);
        }}
      />
      <Input
        value={title}
        disabled={done}
        aria-label="Название этапа"
        className={cn(
          "h-8 min-w-0 flex-1 border-transparent bg-transparent px-1.5 text-sm hover:border-parchment/15",
          done && "line-through opacity-60",
        )}
        title={stage.title}
        onChange={(e) => {
          setTitle(e.target.value);
        }}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
        }}
      />
      <Input
        type="number"
        min={1}
        max={10}
        value={damage}
        disabled={done}
        aria-label="Урон этапа"
        title="Урон по боссу, 1–10"
        className="h-8 w-12 shrink-0 px-1.5 text-sm tabular-nums"
        onChange={(e) => {
          setDamage(e.target.value);
        }}
        onBlur={save}
      />
      <button
        type="button"
        aria-label={`Убрать этап: ${stage.title}`}
        disabled={done}
        className="cursor-pointer text-parchment/60 hover:text-parchment disabled:invisible"
        onClick={() => {
          archiveQuest(stage.id);
        }}
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </li>
  );
}

/** Этапы босса в свитке квеста: урон, порядок перетаскиванием, выполнение печатью. */
export function BossStages({ boss }: { boss: Quest }) {
  const { quests, createQuest, updateQuest } = useGame();
  const stages = stagesOf(quests, boss.id);
  const hp = bossHp(stages);
  const [title, setTitle] = useState("");
  const dragged = useRef<number | null>(null);

  const add = (e: SyntheticEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    void createQuest({
      type: "stage",
      title: clean,
      description: null,
      attribute: boss.attribute,
      difficulty: boss.difficulty,
      scheduledDate: null,
      dueDate: null,
      sortOrder: (stages.at(-1)?.sortOrder ?? 0) + 1,
      parentId: boss.id,
      damage: 2,
      label: null,
    }).then(() => {
      setTitle("");
    });
  };

  const drop = (targetId: number) => {
    const moved = dragged.current;
    dragged.current = null;
    if (moved === null) return;
    reorder(stages, moved, targetId).forEach((stage, index) => {
      if (stage.sortOrder !== index) updateQuest(stage.id, { ...fieldsOf(stage), sortOrder: index });
    });
  };

  return (
    <div className={label}>
      <div className="flex items-baseline justify-between">
        <span>Этапы и урон</span>
        <span className="tabular-nums text-parchment/70">
          Силы {hp.current} / {hp.max}
        </span>
      </div>
      <HpBar hp={hp} size="sm" />
      <ul className="mt-1 flex flex-col gap-1.5">
        {stages.map((s) => (
          <StageRow
            key={s.id}
            stage={s}
            onDragStart={() => {
              dragged.current = s.id;
            }}
            onDropOn={() => {
              drop(s.id);
            }}
          />
        ))}
      </ul>
      <form onSubmit={add}>
        <Input
          value={title}
          placeholder="+ этап (Enter)"
          aria-label="Новый этап"
          className="h-8 text-sm"
          onChange={(e) => {
            setTitle(e.target.value);
          }}
        />
      </form>
      {stages.length === 0 && (
        <p className="text-parchment/60">Разбей проект на этапы. Каждый пройденный этап наносит боссу свой урон.</p>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type DragEvent, type SyntheticEvent } from "react";

import { ATTRIBUTE_LABEL, QUEST_TYPE_SHORT } from "@/app/strings";
import { Coin } from "@/components/kit/icons";
import { AttributePicker, DifficultyPicker, TypePicker } from "@/components/kit/pickers";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { Ribbon } from "@/components/kit/Ribbon";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { completedOn, isOverdue, questColumns } from "@/domain/quests";
import { questReward } from "@/domain/rewards";
import { addDays, humanDate } from "@/domain/time";
import type { GameDate, Quest, QuestFields, QuestType } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

type ColumnKey = "today" | "upcoming" | "backlog";
type Filter = QuestType | "all";

const COLUMN_TITLE: Record<ColumnKey, string> = { today: "Сегодня", upcoming: "Предстоящие", backlog: "Без даты" };

function fieldsOf(q: Quest): QuestFields {
  return {
    type: q.type,
    title: q.title,
    description: q.description,
    attribute: q.attribute,
    difficulty: q.difficulty,
    scheduledDate: q.scheduledDate,
    dueDate: q.dueDate,
    sortOrder: q.sortOrder,
  };
}

function scheduleFor(column: ColumnKey, today: GameDate, current: GameDate | null): GameDate | null {
  switch (column) {
    case "today":
      return today;
    case "upcoming":
      return current !== null && current > today ? current : addDays(today, 1);
    case "backlog":
      return null;
  }
}

const SEAL_COLOR: Record<QuestType, string> = { main: "bg-burgundy", side: "bg-ink" };

function BoardCard({ quest, selected, onSelect }: { quest: Quest; selected: boolean; onSelect: () => void }) {
  const { today } = useGame();
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(quest.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      className={cn(
        "cursor-grab rounded-[var(--radius-panel)] border bg-[var(--panel-parchment)] px-3 py-2 text-wood shadow-md transition-transform active:cursor-grabbing",
        selected ? "border-gold ring-2 ring-gold/60" : "border-wood/20 hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", SEAL_COLOR[quest.type])} />
        <p className="flex-1 text-sm font-medium leading-snug">{quest.title}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-5 text-xs text-wood/60">
        <span>{QUEST_TYPE_SHORT[quest.type]}</span>
        <span>{ATTRIBUTE_LABEL[quest.attribute]}</span>
        <span>{"✦".repeat(quest.difficulty)}</span>
        {quest.scheduledDate && quest.scheduledDate > today && <span>на {humanDate(quest.scheduledDate)}</span>}
        {quest.dueDate &&
          (isOverdue(quest, today) ? <Ribbon>Срок вышел</Ribbon> : <span>до {humanDate(quest.dueDate)}</span>)}
      </div>
    </li>
  );
}

function Column({
  column,
  quests,
  selectedId,
  onSelect,
  onDropQuest,
  onAdd,
}: {
  column: ColumnKey;
  quests: Quest[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDropQuest: (id: number, column: ColumnKey) => void;
  onAdd: (title: string, column: ColumnKey) => void;
}) {
  const [over, setOver] = useState(false);
  const [title, setTitle] = useState("");

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isInteger(id) && id > 0) onDropQuest(id, column);
  };
  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAdd(title.trim(), column);
      setTitle("");
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => {
        setOver(false);
      }}
      onDrop={drop}
      className={cn(
        "flex min-h-0 flex-col rounded-[var(--radius-panel)] border border-dashed p-3 transition-colors",
        over ? "border-gold/70 bg-gold/10" : "border-transparent",
      )}
    >
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-display text-xl text-gold-bright">{COLUMN_TITLE[column]}</h3>
        <span className="text-xs text-parchment/40">{quests.length}</span>
      </div>
      <form onSubmit={submit} className="mb-3">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          placeholder="+ квест"
          className="h-8 text-sm"
          aria-label={`Новый квест: ${COLUMN_TITLE[column]}`}
        />
      </form>
      <ul className="flex flex-col gap-2 overflow-y-auto pb-2 scrollbar-quiet">
        {quests.map((q) => (
          <BoardCard
            key={q.id}
            quest={q}
            selected={q.id === selectedId}
            onSelect={() => {
              onSelect(q.id);
            }}
          />
        ))}
      </ul>
    </div>
  );
}

function Editor({ quest, onClose }: { quest: Quest; onClose: () => void }) {
  const { updateQuest, archiveQuest, settings, character } = useGame();
  const [draft, setDraft] = useState<QuestFields>(() => fieldsOf(quest));
  const saved = useRef(JSON.stringify(fieldsOf(quest)));

  useEffect(() => {
    const serialized = JSON.stringify(draft);
    if (serialized === saved.current || !draft.title.trim()) return;
    const timer = window.setTimeout(() => {
      saved.current = serialized;
      updateQuest(quest.id, draft);
    }, 400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, quest.id, updateQuest]);

  const set = <K extends keyof QuestFields>(key: K, value: QuestFields[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const reward = questReward(draft, settings, character.windStep);

  return (
    <Panel className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto p-5 scrollbar-quiet">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-xl">Свиток квеста</PanelTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Закрыть
        </Button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-parchment/60">
        Название
        <Input
          value={draft.title}
          onChange={(e) => {
            set("title", e.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-parchment/60">
        Описание
        <Textarea
          value={draft.description ?? ""}
          onChange={(e) => {
            set("description", e.target.value || null);
          }}
        />
      </label>
      <div className="flex flex-col gap-1 text-xs text-parchment/60">
        Тип
        <TypePicker
          value={draft.type}
          onChange={(t) => {
            set("type", t);
          }}
        />
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col gap-1 text-xs text-parchment/60">
          Атрибут
          <AttributePicker
            value={draft.attribute}
            onChange={(a) => {
              set("attribute", a);
            }}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs text-parchment/60">
          Сложность
          <DifficultyPicker
            value={draft.difficulty}
            onChange={(d) => {
              set("difficulty", d);
            }}
          />
        </div>
      </div>
      <p className="flex items-center gap-2 text-sm text-parchment/70">
        Награда: +{reward.xp} XP, <Coin className="h-4 w-4" /> {reward.gold}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-parchment/60">
          День
          <Input
            type="date"
            value={draft.scheduledDate ?? ""}
            onChange={(e) => {
              set("scheduledDate", e.target.value || null);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-parchment/60">
          Дедлайн
          <Input
            type="date"
            value={draft.dueDate ?? ""}
            onChange={(e) => {
              set("dueDate", e.target.value || null);
            }}
          />
        </label>
      </div>
      <Button
        variant="quiet"
        size="sm"
        className="mt-auto self-start"
        onClick={() => {
          archiveQuest(quest.id);
          onClose();
        }}
      >
        Убрать с доски
      </Button>
    </Panel>
  );
}

/** Доска квестов: планирование по дням, перетаскивание между колонками, правка справа. */
export function QuestLog() {
  const { quests, today, settings, createQuest, updateQuest } = useGame();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const visible = filter === "all" ? quests : quests.filter((q) => q.type === filter);
  const cols = questColumns(visible, today, settings.dayStartHour);
  const selected = quests.find((q) => q.id === selectedId && q.status === "active") ?? null;

  const move = (id: number, column: ColumnKey) => {
    const quest = quests.find((q) => q.id === id);
    if (!quest || quest.status !== "active") return;
    const scheduledDate = scheduleFor(column, today, quest.scheduledDate);
    if (scheduledDate !== quest.scheduledDate) {
      updateQuest(id, { ...fieldsOf(quest), scheduledDate });
    }
  };

  const add = (title: string, column: ColumnKey) => {
    void createQuest({
      type: filter === "main" ? "main" : "side",
      title,
      description: null,
      attribute: "agility",
      difficulty: 1,
      scheduledDate: scheduleFor(column, today, null),
      dueDate: null,
      sortOrder: 0,
    }).then((q) => {
      setSelectedId(q.id);
    });
  };

  const filters: ReadonlyArray<[Filter, string]> = [
    ["all", "Все"],
    ["main", "Main"],
    ["side", "Side"],
  ];

  return (
    <div className="flex h-full gap-5 p-6">
      <Panel className="flex min-w-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between px-2">
          <PanelTitle>Доска квестов</PanelTitle>
          <div className="flex gap-1">
            {filters.map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "outline" : "ghost"}
                onClick={() => {
                  setFilter(key);
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-2">
          {(["today", "upcoming", "backlog"] as const).map((c) => (
            <Column key={c} column={c} quests={cols[c]} selectedId={selectedId} onSelect={setSelectedId} onDropQuest={move} onAdd={add} />
          ))}
        </div>
        <div className="mt-2 border-t border-gold/15 px-2 pt-2">
          <button
            type="button"
            className="cursor-pointer text-sm text-parchment/60 hover:text-parchment"
            onClick={() => {
              setArchiveOpen((v) => !v);
            }}
          >
            {archiveOpen ? "▾" : "▸"} Архив подвигов за 30 дней · {cols.archive.length}
          </button>
          {archiveOpen && (
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto text-sm text-parchment/60 scrollbar-quiet">
              {cols.archive.map((q) => (
                <li key={q.id} className="flex justify-between gap-4">
                  <span className="truncate line-through decoration-gold/50">{q.title}</span>
                  <span className="shrink-0 text-xs">{humanDate(completedOn(q, settings.dayStartHour) ?? today)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
      {selected && (
        <Editor
          key={selected.id}
          quest={selected}
          onClose={() => {
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

import { useEffect, useRef, useState, type DragEvent, type SyntheticEvent } from "react";

import { ATTRIBUTE_LABEL, QUEST_TYPE_SHORT, xpText } from "@/app/strings";
import { HpBar } from "@/components/kit/HpBar";
import { Coin } from "@/components/kit/icons";
import { AttributePicker, DifficultyPicker, TypePicker } from "@/components/kit/pickers";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { Chip } from "@/components/kit/pickers";
import { QuestSteps } from "@/components/kit/QuestSteps";
import { Ribbon } from "@/components/kit/Ribbon";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { bossHp, stagesOf } from "@/domain/bosses";
import { cleanLabel, completedOn, dayLoad, fieldsOf, isOverdue, labelsOf, MAP_DAYS, questMap, SPYGLASS_DAYS, stepsOf } from "@/domain/quests";
import { plural } from "@/domain/plural";
import { questReward } from "@/domain/rewards";
import { addDays, humanDate, humanWeekday, shortWeekday } from "@/domain/time";
import { BOARD_TYPES, type GameDate, type Quest, type QuestFields, type QuestType } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { BossStages } from "./BossStages";

/** Полоса карты: игровой день или `null` для квестов без даты. Совпадает с `scheduledDate`. */
type LaneKey = GameDate | null;

function laneTitle(lane: LaneKey, today: GameDate): string {
  if (lane === null) return "Без даты";
  if (lane === today) return "Сегодня";
  if (lane === addDays(today, 1)) return "Завтра";
  const name = humanWeekday(lane);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function laneTab(lane: LaneKey, today: GameDate): string {
  if (lane === null || lane === today || lane === addDays(today, 1)) return laneTitle(lane, today);
  return `${shortWeekday(lane)} ${lane.slice(8).replace(/^0/, "")}`;
}

const SEAL_COLOR: Record<QuestType, string> = { main: "bg-burgundy", side: "bg-ink", boss: "bg-gold", stage: "bg-gold" };

function BoardCard({
  quest,
  selected,
  showDate,
  onSelect,
}: {
  quest: Quest;
  selected: boolean;
  showDate: boolean;
  onSelect: () => void;
}) {
  const { today, quests } = useGame();
  const hp = quest.type === "boss" ? bossHp(stagesOf(quests, quest.id)) : null;
  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(quest.id));
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onSelect}
      // Без мыши карточка выбирается с клавиатуры, а переносится полем «День» в карточке квеста.
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "cursor-grab rounded-[var(--radius-panel)] border bg-[var(--panel-parchment)] px-3 py-2 text-wood shadow-md transition-transform focus-visible:outline-2 focus-visible:outline-gold-bright active:cursor-grabbing",
        selected ? "border-gold ring-2 ring-gold/60" : "border-wood/20 hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", SEAL_COLOR[quest.type])} />
        <p className="flex-1 text-sm font-medium leading-snug">{quest.title}</p>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 pl-5 text-xs text-wood/75">
        <span>{QUEST_TYPE_SHORT[quest.type]}</span>
        <span>{ATTRIBUTE_LABEL[quest.attribute]}</span>
        <span>{"✦".repeat(quest.difficulty)}</span>
        {quest.label && <span className="rounded-full bg-wood/10 px-1.5">{quest.label}</span>}
        {showDate && quest.scheduledDate && quest.scheduledDate > today && <span>на {humanDate(quest.scheduledDate)}</span>}
        {quest.dueDate &&
          (isOverdue(quest, today) ? <Ribbon>Срок вышел</Ribbon> : <span>до {humanDate(quest.dueDate)}</span>)}
      </div>
      {hp && (
        <div className="mt-1.5 flex items-center gap-2 pl-5 text-[11px] text-wood/75">
          <HpBar hp={hp} size="sm" className="flex-1" />
          <span className="tabular-nums">
            {hp.current}/{hp.max}
          </span>
        </div>
      )}
    </li>
  );
}

function Lane({
  lane,
  quests,
  later,
  hidden,
  focused,
  selectedId,
  onFocus,
  onSelect,
  onDropQuest,
}: {
  lane: LaneKey;
  quests: Quest[];
  later: Quest[];
  hidden: boolean;
  focused: boolean;
  selectedId: number | null;
  onFocus: () => void;
  onSelect: (id: number) => void;
  onDropQuest: (id: number, lane: LaneKey) => void;
}) {
  const { today, settings, character } = useGame();
  const [over, setOver] = useState(false);
  const load = dayLoad(quests, settings, character.windStep);
  
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isInteger(id) && id > 0) onDropQuest(id, lane);
  };

  const cards = (list: Quest[], showDate: boolean) =>
    list.map((q) => (
      <BoardCard
        key={q.id}
        quest={q}
        selected={q.id === selectedId}
        showDate={showDate}
        onSelect={() => {
          onSelect(q.id);
        }}
      />
    ));

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
        "min-h-0 flex-col rounded-[var(--radius-panel)] border border-dashed p-1 transition-colors md:flex md:basis-0 md:p-2",
        lane === null ? "md:min-w-48 md:flex-[1.3]" : "md:min-w-[9.5rem] md:flex-1",
        hidden ? "hidden" : "flex",
        over ? "border-gold/70 bg-gold/10" : focused ? "border-gold/30" : "border-transparent",
      )}
    >
      <button
        type="button"
        onClick={onFocus}
        className="mb-2 hidden cursor-pointer flex-col items-start rounded px-1 text-left md:flex"
        aria-pressed={focused}
        title="Новые квесты лягут сюда"
      >
        <span className={cn("font-display text-xl", focused ? "text-gold-bright" : "text-parchment/80")}>
          {laneTitle(lane, today)}
        </span>
        {lane !== null && <span className="text-xs text-parchment/60">{humanDate(lane)}</span>}
        <span className="text-xs text-parchment/60">
          {load.count > 0 ? `${load.count} ${plural(load.count, "квест", "квеста", "квестов")}${load.xp > 0 ? ` · ${String(load.xp)} опыта` : ""}` : "свободно"}
        </span>
      </button>
      {lane === today && quests.length > 0 && (
        <p className="mb-2 px-1 text-xs text-parchment/60">Выполняются в Тронном зале</p>
      )}
      <ul className="flex flex-col gap-2 overflow-y-auto pb-2 scrollbar-quiet">
        {cards(quests, false)}
        {quests.length === 0 && later.length === 0 && (
          <li className="grid min-h-28 place-items-center rounded-lg border border-dashed border-parchment/15 bg-wood/30 px-3 py-6 text-center text-xs leading-relaxed text-parchment/60">
            {lane === null ? "Здесь ждут квесты без даты" : "День свободен. Перетащи сюда свиток или возьми квест в поле сверху"}
          </li>
        )}
        {later.length > 0 && (
          <li className="mt-2 px-1 text-xs uppercase tracking-wider text-parchment/60">Позже</li>
        )}
        {cards(later, true)}
      </ul>
    </div>
  );
}

function Editor({ quest, onClose }: { quest: Quest; onClose: () => void }) {
  const { updateQuest, archiveQuest, settings, character, quests, today, steps } = useGame();
  const hasStages = stagesOf(quests, quest.id).length > 0;
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
  const stepsDone = stepsOf(steps, quest.id).filter((s) => s.doneAt !== null).length;
  const reward = questReward(draft, settings, character.windStep, draft.type === "boss" ? 0 : stepsDone);
  const [labelText, setLabelText] = useState(quest.label ?? "");

  return (
    <Panel className="mobile-sheet flex shrink-0 flex-col gap-4 overflow-y-auto p-5 scrollbar-quiet md:w-80">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-xl">Свиток квеста</PanelTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Закрыть
        </Button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-parchment/70">
        Название
        <Input
          value={draft.title}
          onChange={(e) => {
            set("title", e.target.value);
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-parchment/70">
        Описание
        <Textarea
          value={draft.description ?? ""}
          onChange={(e) => {
            set("description", e.target.value || null);
          }}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-parchment/70">
        Метка
        <Input
          value={labelText}
          list="quest-labels"
          placeholder="Работа, Дом, Учёба…"
          maxLength={40}
          onChange={(e) => {
            setLabelText(e.target.value);
            set("label", cleanLabel(e.target.value));
          }}
        />
        <datalist id="quest-labels">
          {labelsOf(quests).map((l) => (
            <option key={l} value={l} />
          ))}
        </datalist>
      </label>
      <div className="flex flex-col gap-1 text-xs text-parchment/70">
        Тип
        <TypePicker
          options={BOARD_TYPES}
          value={draft.type}
          disabled={hasStages}
          onChange={(t) => {
            set("type", t);
          }}
        />
      </div>
      <div className="flex gap-4">
        <div className="flex flex-col gap-1 text-xs text-parchment/70">
          Атрибут
          <AttributePicker
            value={draft.attribute}
            onChange={(a) => {
              set("attribute", a);
            }}
          />
        </div>
        <div className="flex flex-col gap-1 text-xs text-parchment/70">
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
        {draft.type === "boss" ? "За победу" : "Награда"}: {xpText(reward.xp)}, <Coin className="h-4 w-4" /> {reward.gold}
      </p>
      {draft.type === "boss" ? (
        <BossStages boss={quest} />
      ) : (
        quest.type !== "boss" && (
          <div className="flex flex-col gap-1 text-xs text-parchment/70">
            Чек-лист
            <QuestSteps quest={quest} editable />
          </div>
        )
      )}
      <div className="flex flex-wrap gap-2 md:hidden" aria-label="Перенести">
        {(
          [
            ["На сегодня", today],
            ["На завтра", addDays(today, 1)],
            ["Без даты", null],
          ] satisfies ReadonlyArray<[string, GameDate | null]>
        ).map(([label, date]) => (
          <Button
            key={label}
            size="sm"
            variant={draft.scheduledDate === date ? "outline" : "ghost"}
            onClick={() => {
              set("scheduledDate", date);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-parchment/70">
          День
          <Input
            type="date"
            className={cn(draft.scheduledDate === null && "opacity-40")}
            value={draft.scheduledDate ?? ""}
            onChange={(e) => {
              set("scheduledDate", e.target.value || null);
            }}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-parchment/70">
          Дедлайн
          <Input
            type="date"
            className={cn(draft.dueDate === null && "opacity-40")}
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

/** Доска квестов: квесты по дням недели вперёд, перетаскивание между днями, правка справа. */
export function QuestLog() {
  const { quests, today, settings, perks, createQuest, updateQuest } = useGame();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [focus, setFocus] = useState<LaneKey>(null);
  const [title, setTitle] = useState("");
  const [labelFilter, setLabelFilter] = useState<string | null>(null);
  const labels = labelsOf(quests);
  const filter = labelFilter !== null && labels.includes(labelFilter) ? labelFilter : null;
  const shown = filter === null ? quests : quests.filter((q) => q.label === filter || q.type === "stage");

  const map = questMap(shown, today, settings.dayStartHour, perks.has("spyglass") ? SPYGLASS_DAYS : MAP_DAYS);
  const lanes: LaneKey[] = [null, ...map.days.map((d) => d.date)];
  const target: LaneKey = lanes.includes(focus) ? focus : null;
  const selected = quests.find((q) => q.id === selectedId && q.status === "active") ?? null;
  const questsOf = (lane: LaneKey) => (lane === null ? map.backlog : (map.days.find((d) => d.date === lane)?.quests ?? []));

  const move = (id: number, lane: LaneKey) => {
    const quest = quests.find((q) => q.id === id);
    if (!quest || quest.status !== "active") return;
    if (lane !== quest.scheduledDate) {
      updateQuest(id, { ...fieldsOf(quest), scheduledDate: lane });
    }
  };

  const add = (e: SyntheticEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    void createQuest({
      type: "side",
      title: clean,
      description: null,
      attribute: "agility",
      difficulty: 1,
      scheduledDate: target,
      dueDate: null,
      sortOrder: 0,
      parentId: null,
      damage: 1,
      label: filter,
    }).then((q) => {
      setTitle("");
      setSelectedId(q.id);
    });
  };

  return (
    <div className="flex h-full gap-5 p-3 md:p-6">
      <Panel className="flex min-w-0 flex-1 flex-col p-3 md:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2">
          <PanelTitle>Доска квестов</PanelTitle>
          <form onSubmit={add} className="flex min-w-0 flex-1 basis-64 md:max-w-md">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              placeholder={`+ квест: ${laneTitle(target, today).toLowerCase()}`}
              className="h-8 text-sm"
              aria-label={`Новый квест: ${laneTitle(target, today)}`}
            />
          </form>
        </div>
        {labels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5 px-2" aria-label="Метки">
            <Chip
              active={filter === null}
              onClick={() => {
                setLabelFilter(null);
              }}
            >
              Все
            </Chip>
            {labels.map((l) => (
              <Chip
                key={l}
                active={filter === l}
                onClick={() => {
                  setLabelFilter(filter === l ? null : l);
                }}
              >
                {l}
              </Chip>
            ))}
          </div>
        )}
        <div className="mb-2 flex gap-1 overflow-x-auto px-1 scrollbar-quiet md:hidden" role="tablist">
          {lanes.map((lane) => (
            <Button
              key={lane ?? "backlog"}
              role="tab"
              aria-selected={target === lane}
              size="sm"
              variant={target === lane ? "outline" : "ghost"}
              className="shrink-0 px-2 text-[13px]"
              onClick={() => {
                setFocus(lane);
              }}
            >
              {laneTab(lane, today)} · {questsOf(lane).length + (lane === null ? map.later.length : 0)}
            </Button>
          ))}
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row md:gap-2 md:overflow-x-auto md:scrollbar-quiet">
          {lanes.map((lane) => (
            <Lane
              key={lane ?? "backlog"}
              lane={lane}
              quests={questsOf(lane)}
              later={lane === null ? map.later : []}
              hidden={target !== lane}
              focused={target === lane}
              selectedId={selectedId}
              onFocus={() => {
                setFocus(lane);
              }}
              onSelect={setSelectedId}
              onDropQuest={move}
            />
          ))}
        </div>
        <div className="mt-2 border-t border-gold/15 px-2 pt-2">
          <button
            type="button"
            className="cursor-pointer text-sm text-parchment/70 hover:text-parchment"
            onClick={() => {
              setArchiveOpen((v) => !v);
            }}
          >
            {archiveOpen ? "▾" : "▸"} Архив подвигов за 30 дней · {map.archive.length}
          </button>
          {archiveOpen && (
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto text-sm text-parchment/70 scrollbar-quiet">
              {map.archive.map((q) => (
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

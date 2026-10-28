import { useState, type SyntheticEvent } from "react";

import { BossCard } from "@/components/kit/BossCard";
import { ChronicleForm } from "@/components/kit/ChronicleForm";
import { HeroPanel } from "@/components/kit/HeroPanel";
import { AttributePicker, DifficultyPicker, TypePicker } from "@/components/kit/pickers";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { QuestCard } from "@/components/kit/QuestCard";
import { ReturnCard } from "@/components/kit/ReturnCard";
import { RitualRow } from "@/components/kit/RitualRow";
import { ValorRow } from "@/components/kit/ValorRow";
import { SagaSeal } from "@/components/kit/Saga";
import { WeekPanel } from "@/components/kit/WeekPanel";
import { WeekRecap } from "@/components/kit/WeekRecap";
import { YesterdayCard } from "@/components/kit/YesterdayCard";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { isBlank } from "@/domain/chronicle";
import { todayBoard } from "@/domain/quests";
import { humanDate, humanWeekday } from "@/domain/time";
import type { Attribute, Difficulty, QuestType } from "@/domain/types";
import { useEvening } from "@/services/clock";
import { useGame } from "@/services/game";

import { RitualsDrawer } from "./RitualsDrawer";

function QuickAdd() {
  const { createQuest, today } = useGame();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<QuestType>("side");
  const [attribute, setAttribute] = useState<Attribute>("agility");
  const [difficulty, setDifficulty] = useState<Difficulty>(1);

  const submit = (e: SyntheticEvent) => {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    void createQuest({
      type,
      title: clean,
      description: null,
      attribute,
      difficulty,
      scheduledDate: today,
      dueDate: null,
      sortOrder: 0,
      parentId: null,
      damage: 1,
      label: null,
    }).then(() => {
      setTitle("");
    });
  };

  return (
    <Panel className="p-4">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <Input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          placeholder="Новый квест на сегодня…"
          aria-label="Новый квест"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TypePicker value={type} onChange={setType} />
          <div className="flex gap-2">
            <AttributePicker value={attribute} onChange={setAttribute} />
            <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          </div>
        </div>
        <Button type="submit" size="sm" disabled={!title.trim()} className="self-end">
          Взять квест
        </Button>
      </form>
    </Panel>
  );
}

function TodayPanel({ onOpenBoard, onEditRituals }: { onOpenBoard: () => void; onEditRituals: () => void }) {
  const { quests, today, settings } = useGame();
  const board = todayBoard(quests, today, settings.dayStartHour);

  return (
    <Panel className="flex max-h-full min-h-0 flex-col p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3">
        <PanelTitle>Приказы на сегодня</PanelTitle>
        <span className="text-sm text-parchment/50">
          {humanWeekday(today)}, {humanDate(today)}
        </span>
      </div>
      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto scrollbar-quiet">
        {board.active.length === 0 && board.done.length === 0 ? (
          <div className="grid place-items-center py-8 text-center">
            <div>
              <p className="font-display text-2xl text-parchment/80">Сегодня приказов нет</p>
              <p className="mt-1 text-sm text-parchment/50">Возьми квест с доски или отдохни у камина.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onOpenBoard}>
                Открыть доску квестов
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {board.active.map((q) => (
                <QuestCard key={q.id} quest={q} />
              ))}
            </ul>
            {board.done.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-parchment/40">Совершено сегодня</p>
                <ul className="flex flex-col gap-2">
                  {board.done.map((q) => (
                    <QuestCard key={q.id} quest={q} />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
        <div className="border-t border-gold/15 pt-4">
          <InnLine />
          <RitualRow onEdit={onEditRituals} />
          <ValorRow />
        </div>
        <ChronicleLine />
      </div>
    </Panel>
  );
}

/** В дни таверны над ритуалами тихая строка: ничего не ждёт, но сделать дело можно. */
function InnLine() {
  const { stay, innDates, today, checkOutInn } = useGame();
  if (!stay || !innDates.has(today)) return null;
  return (
    <p className="mb-3 text-sm text-parchment/60">
      Герой в таверне до {humanDate(stay.endDate)}, ритуалы подождут.{" "}
      <button type="button" className="cursor-pointer text-gold/80 hover:text-gold-bright" onClick={checkOutInn}>
        Вернуться раньше
      </button>
    </p>
  );
}

/** Вечером под делами дня появляется тонкая строка хроники. Не обязательна и не напоминает повторно. */
function ChronicleLine() {
  const { chronicle, today, settings } = useGame();
  const evening = useEvening(settings.dayStartHour);
  const [open, setOpen] = useState(false);
  const entry = chronicle.find((e) => e.gameDate === today);
  const written = entry !== undefined && !isBlank(entry);
  if (!evening && !written) return null;

  return (
    <>
      <button
        type="button"
        className="cursor-pointer self-start text-sm text-parchment/50 hover:text-gold-bright"
        onClick={() => {
          setOpen(true);
        }}
      >
        {written ? "Хроника дня записана · дополнить" : "Записать в хронику"}
      </button>
      <Dialog open={open} onOpenChange={setOpen} title="Хроника дня" description={`${humanWeekday(today)}, ${humanDate(today)}`}>
        <ChronicleForm
          date={today}
          onDone={() => {
            setOpen(false);
          }}
        />
      </Dialog>
    </>
  );
}

/** Тронный зал: что сделать сегодня и статус героя. Редактор ритуалов встаёт на место списка дня. */
export function Dashboard({ onOpenBoard }: { onOpenBoard: () => void }) {
  const [ritualsOpen, setRitualsOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3 scrollbar-quiet md:grid md:grid-cols-[minmax(300px,340px)_1fr] md:items-start md:gap-5 md:p-6 xl:grid-cols-[340px_1fr_minmax(480px,560px)]">
      <div className="order-2 flex shrink-0 flex-col gap-4 md:order-none md:gap-5">
        <HeroPanel />
        <WeekPanel />
        <QuickAdd />
      </div>
      <div className="hidden xl:block" aria-hidden />
      <div className="order-1 flex shrink-0 flex-col gap-4 md:order-none md:min-h-0 md:shrink md:gap-5">
        <YesterdayCard />
        <ReturnCard />
        <SagaSeal />
        <WeekRecap />
        {ritualsOpen ? (
          <RitualsDrawer
            onClose={() => {
              setRitualsOpen(false);
            }}
          />
        ) : (
          <TodayPanel
            onOpenBoard={onOpenBoard}
            onEditRituals={() => {
              setRitualsOpen(true);
            }}
          />
        )}
        <BossCard onOpenBoard={onOpenBoard} />
      </div>
    </div>
  );
}

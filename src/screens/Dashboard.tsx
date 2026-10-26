import { useState, type SyntheticEvent } from "react";

import { HeroPanel } from "@/components/kit/HeroPanel";
import { AttributePicker, DifficultyPicker, TypePicker } from "@/components/kit/pickers";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { QuestCard } from "@/components/kit/QuestCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayBoard } from "@/domain/quests";
import { humanDate, humanWeekday } from "@/domain/time";
import type { Attribute, Difficulty, QuestType } from "@/domain/types";
import { useGame } from "@/services/game";

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

/** Тронный зал: что сделать сегодня и статус героя. */
export function Dashboard({ onOpenBoard }: { onOpenBoard: () => void }) {
  const { quests, today, settings } = useGame();
  const board = todayBoard(quests, today, settings.dayStartHour);

  return (
    <div className="grid h-full grid-cols-[minmax(300px,340px)_1fr] items-start gap-5 overflow-y-auto p-6 scrollbar-quiet xl:grid-cols-[340px_1fr_minmax(480px,560px)]">
      <div className="flex flex-col gap-5">
        <HeroPanel />
        <QuickAdd />
      </div>
      <div className="hidden xl:block" aria-hidden />
      <Panel className="flex max-h-full min-h-0 flex-col p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <PanelTitle>Приказы на сегодня</PanelTitle>
          <span className="text-sm text-parchment/50">
            {humanWeekday(today)}, {humanDate(today)}
          </span>
        </div>
        {board.active.length === 0 && board.done.length === 0 ? (
          <div className="grid place-items-center py-10 text-center">
            <div>
              <p className="font-display text-2xl text-parchment/80">Сегодня приказов нет</p>
              <p className="mt-1 text-sm text-parchment/50">Возьми квест с доски или отдохни у камина.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={onOpenBoard}>
                Открыть доску квестов
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 overflow-y-auto scrollbar-quiet">
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
          </div>
        )}
      </Panel>
    </div>
  );
}

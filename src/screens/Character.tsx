import { useState } from "react";

import { ATTRIBUTE_HINT, ATTRIBUTE_LABEL, daysWord } from "@/app/strings";
import { ATTRIBUTE_ICON } from "@/components/kit/icons";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { levelProgress, titleForLevel } from "@/domain/levels";
import { isSuccess } from "@/domain/streak";
import { addDays, humanDate, weekday } from "@/domain/time";
import { ATTRIBUTES, type Day } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

const WEEKS = 8;
const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function cellTone(day: Day | undefined, isFuture: boolean): string {
  if (isFuture) return "bg-transparent border-parchment/5";
  if (day?.kind === "rest") return "bg-ember/40 border-ember/50";
  if (isSuccess(day)) return "bg-gold/80 border-gold";
  return "bg-ink-deep/40 border-parchment/10";
}

function StreakCalendar() {
  const { days, today } = useGame();
  const byDate = new Map(days.map((d) => [d.gameDate, d]));
  const start = addDays(today, -(WEEKS * 7 - 1) - (6 - weekday(today)));
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));

  return (
    <div className="flex gap-2">
      <div className="grid grid-rows-7 gap-1 text-[10px] text-parchment/40">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} className="h-4 leading-4">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-1">
        {cells.map((date) => {
          const day = byDate.get(date);
          const future = date > today;
          const label = future ? "" : day?.kind === "rest" ? "день отдыха" : isSuccess(day) ? `подвигов: ${day?.deedsCount ?? 0}` : "без дел";
          return (
            <Tooltip key={date} content={`${humanDate(date)}${label ? ` · ${label}` : ""}`}>
              <span className={cn("block h-4 w-4 rounded-sm border", cellTone(day, future), date === today && "ring-1 ring-parchment/70")} />
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

function NameField() {
  const { character, renameCharacter } = useGame();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(character.name);

  if (!editing) {
    return (
      <button
        type="button"
        className="cursor-text text-left font-display text-4xl text-parchment hover:text-gold-bright"
        onClick={() => {
          setName(character.name);
          setEditing(true);
        }}
        title="Изменить имя"
      >
        {character.name}
      </button>
    );
  }
  const save = () => {
    const clean = name.trim();
    if (clean && clean !== character.name) renameCharacter(clean);
    setEditing(false);
  };
  return (
    <Input
      autoFocus
      value={name}
      maxLength={60}
      className="h-12 font-display text-3xl"
      onChange={(e) => {
        setName(e.target.value);
      }}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

/** Герой: путь персонажа, атрибуты и серии. Только просмотр, без действий с квестами. */
export function CharacterScreen() {
  const { character, settings } = useGame();
  const progress = levelProgress(character.xp, settings.levelCurve);
  const maxAttr = Math.max(10, character.strength, character.intellect, character.agility);

  return (
    <div className="grid h-full grid-cols-2 gap-6 p-6">
      <div aria-hidden />
      <div className="flex flex-col gap-5 overflow-y-auto scrollbar-quiet">
        <Panel className="p-6">
          <NameField />
          <p className="text-gold-bright/90">
            {character.title} · уровень {progress.level}
          </p>
          <p className="mt-3 text-sm text-parchment/70">
            Опыт: {character.xp} всего, {progress.needed - progress.into} до уровня {progress.level + 1}
            {` (${titleForLevel(progress.level + 1)})`}
          </p>
        </Panel>

        <Panel className="p-6">
          <PanelTitle className="mb-4 text-xl">Атрибуты</PanelTitle>
          <ul className="flex flex-col gap-4">
            {ATTRIBUTES.map((a) => {
              const Icon = ATTRIBUTE_ICON[a];
              return (
                <li key={a}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-gold" />
                    <span className="flex-1 font-display text-lg">{ATTRIBUTE_LABEL[a]}</span>
                    <span className="font-display text-xl tabular-nums text-gold-bright">{character[a]}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-deep/70">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright" style={{ width: `${(character[a] / maxAttr) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-parchment/50">{ATTRIBUTE_HINT[a]}</p>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel className="p-6">
          <div className="mb-4 flex items-baseline justify-between">
            <PanelTitle className="text-xl">Серия</PanelTitle>
            <span className="text-sm text-parchment/70">
              сейчас <span className="font-display text-lg text-gold-bright">{character.streakCurrent}</span> {daysWord(character.streakCurrent)} · лучшая{" "}
              {character.streakBest}
            </span>
          </div>
          <StreakCalendar />
        </Panel>
      </div>
    </div>
  );
}

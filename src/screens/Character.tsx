import { useEffect, useRef, useState } from "react";

import { ATTRIBUTE_HINT, ATTRIBUTE_LABEL, daysWord, MOOD_LABEL, plural } from "@/app/strings";
import { ChronicleForm } from "@/components/kit/ChronicleForm";
import { CrestEditor } from "@/components/kit/CrestEditor";
import { Equipment } from "@/components/kit/Equipment";
import { HallOfFame } from "@/components/kit/HallOfFame";
import { ATTRIBUTE_ICON } from "@/components/kit/icons";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { SagaArchive } from "@/components/kit/Saga";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { isBlank } from "@/domain/chronicle";
import { bestMonth, deedsTotal, favoriteAttribute, journeyDays } from "@/domain/journey";
import { levelProgress, titleForLevel } from "@/domain/levels";
import { isSuccess } from "@/domain/streak";
import { addDays, calendarStart, humanDate, humanMonth } from "@/domain/time";
import { ATTRIBUTES, type Day, type Quest } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

/** Календарь Книги подвигов: год неделями, текущая неделя справа. */
const WEEKS = 53;
const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

function cellTone(day: Day | undefined, isFuture: boolean): string {
  if (isFuture) return "bg-transparent border-parchment/5";
  if (day?.kind === "rest") return "bg-ember/40 border-ember/50";
  if (isSuccess(day)) return "bg-gold/80 border-gold";
  return "bg-ink-deep/40 border-parchment/10";
}

/** Год пути: закрашены дни с делами, отдых камином, пустые клетки нейтральные, без красного. */
function JourneyCalendar() {
  const { days, today } = useGame();
  const byDate = new Map(days.map((d) => [d.gameDate, d]));
  const start = calendarStart(today, WEEKS);
  const cells = Array.from({ length: WEEKS * 7 }, (_, i) => addDays(start, i));
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  return (
    <div className="flex gap-2">
      <div className="grid grid-rows-7 gap-[3px] text-[10px] text-parchment/40">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} className="h-3 leading-3">
            {d}
          </span>
        ))}
      </div>
      <div ref={scroller} className="min-w-0 overflow-x-auto pb-1 scrollbar-quiet">
        <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
          {cells.map((date) => {
            const day = byDate.get(date);
            const future = date > today;
            const label = future ? "" : day?.kind === "rest" ? "день отдыха" : isSuccess(day) ? `подвигов: ${String(day?.deedsCount ?? 0)}` : "без дел";
            return (
              <Tooltip key={date} content={`${humanDate(date)}${label ? ` · ${label}` : ""}`}>
                <span className={cn("block h-3 w-3 rounded-[2px] border", cellTone(day, future), date === today && "ring-1 ring-parchment/70")} />
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-xl leading-none text-gold-bright tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-parchment/55">{label}</p>
    </div>
  );
}

/** Книга подвигов: весь пройденный путь. Главная цифра здесь дни в походе, серия идёт второй строкой. */
function BookOfDeeds() {
  const { character, days, quests } = useGame();
  const total = journeyDays(days);
  const month = bestMonth(days);
  const favorite = favoriteAttribute(character);
  const done = (type: Quest["type"]) => quests.filter((q) => q.type === type && q.status === "done").length;

  return (
    <Panel className="p-6">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <PanelTitle className="text-xl">Книга подвигов</PanelTitle>
        <span className="text-sm text-parchment/70">
          <span className="font-display text-lg text-gold-bright">{total}</span> {plural(total, "день", "дня", "дней")} в походе
        </span>
      </div>
      <p className="mb-4 text-sm text-parchment/55">
        Серия сейчас {character.streakCurrent} {daysWord(character.streakCurrent)}, лучшая {character.streakBest}. В поход засчитывается каждый день с делом, подряд не обязательно.
      </p>
      <JourneyCalendar />
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Fact value={String(deedsTotal(days))} label="дел за всё время" />
        <Fact value={String(done("main"))} label="главных квестов" />
        <Fact value={String(done("side"))} label="побочных квестов" />
        <Fact value={String(done("boss"))} label={plural(done("boss"), "босс повержен", "босса повержено", "боссов повержено")} />
        {month && <Fact value={String(month.days)} label={`лучший месяц: ${humanMonth(month.month)}`} />}
        {favorite && <Fact value={String(character[favorite])} label={`любимый атрибут: ${ATTRIBUTE_LABEL[favorite].toLowerCase()}`} />}
      </div>
    </Panel>
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
const CHRONICLE_PAGE = 30;

/** Летопись: лента записей хроники, клик раскрывает запись. Писать можно только за сегодня. */
function Chronicle() {
  const { chronicle, today } = useGame();
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [writing, setWriting] = useState(false);
  const entries = chronicle.filter((e) => !isBlank(e)).slice(0, CHRONICLE_PAGE);
  const todayWritten = entries.some((e) => e.gameDate === today);

  return (
    <Panel className="p-6">
      <div className="mb-3 flex items-baseline justify-between">
        <PanelTitle className="text-xl">Летопись</PanelTitle>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setWriting(true);
          }}
        >
          {todayWritten ? "Дополнить сегодняшнюю" : "Запись за сегодня"}
        </Button>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-parchment/50">Здесь будут твои вечерние записи: что произошло, что заметил, что чувствуешь.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entries.map((e) => {
            const open = openDate === e.gameDate;
            return (
              <li key={e.gameDate} className="rounded-[var(--radius-panel)] border border-parchment/10 bg-ink-deep/35">
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex w-full cursor-pointer items-baseline gap-3 px-3 py-2 text-left"
                  onClick={() => {
                    setOpenDate(open ? null : e.gameDate);
                  }}
                >
                  <span className="w-28 shrink-0 text-sm text-gold-bright/80">{humanDate(e.gameDate)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-parchment/80">{e.happened || e.noticed || e.feeling || "—"}</span>
                  {e.mood !== null && <span className="shrink-0 text-xs text-parchment/45">{MOOD_LABEL[e.mood]}</span>}
                </button>
                {open && (
                  <dl className="flex flex-col gap-2 border-t border-parchment/10 px-3 py-2.5 text-sm">
                    {(
                      [
                        ["Что произошло", e.happened],
                        ["Что заметил", e.noticed],
                        ["Что чувствую", e.feeling],
                      ] as const
                    )
                      .filter(([, text]) => text.trim())
                      .map(([title, text]) => (
                        <div key={title}>
                          <dt className="text-xs text-parchment/45">{title}</dt>
                          <dd className="whitespace-pre-wrap text-parchment/85">{text}</dd>
                        </div>
                      ))}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <Dialog open={writing} onOpenChange={setWriting} title="Хроника дня" description={humanDate(today)}>
        <ChronicleForm
          date={today}
          onDone={() => {
            setWriting(false);
          }}
        />
      </Dialog>
    </Panel>
  );
}

export function CharacterScreen() {
  const { character, settings } = useGame();
  const progress = levelProgress(character.xp, settings.levelCurve);
  const maxAttr = Math.max(10, character.strength, character.intellect, character.agility);

  return (
    <div className="h-full overflow-y-auto p-3 scrollbar-quiet md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:p-6">
      <div className="hidden md:block" aria-hidden />
      <div className="flex flex-col gap-4 md:min-h-0 md:gap-5 scrollbar-quiet md:overflow-y-auto">
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

        <Equipment />

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

        <BookOfDeeds />

        <SagaArchive />

        <HallOfFame />

        <CrestEditor />

        <Chronicle />
      </div>
    </div>
  );
}

import { useState } from "react";

import { daysWord } from "@/app/strings";
import { journeyDays } from "@/domain/journey";
import { nextChapterIn, SAGA, sagaChapter, sagaContext, type SagaChapter, type SagaContext } from "@/domain/saga";
import { useGame } from "@/services/game";

import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Panel, PanelTitle } from "./Panel";

/** Подстановки для глав: имя, дар героя, нынешний штаб и последний побеждённый босс. */
function useSagaContext(): SagaContext {
  const { character, locations, quests } = useGame();
  const home = locations.find((l) => l.key === character.locationKey)?.name ?? "Башня";
  const lastBoss = quests
    .filter((q) => q.type === "boss" && q.status === "done")
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))[0];
  return sagaContext(character, home, lastBoss?.title ?? null);
}

function chapterNumber(ch: SagaChapter): number {
  return SAGA.indexOf(ch) + 1;
}

function Reader({ chapter, onClose }: { chapter: SagaChapter | null; onClose: () => void }) {
  const context = useSagaContext();
  return (
    <Dialog
      open={chapter !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={chapter ? chapter.title : ""}
      description={chapter ? `Глава ${String(chapterNumber(chapter))} из ${String(SAGA.length)}` : ""}
    >
      {chapter && (
        <div className="flex flex-col gap-3 font-display text-lg leading-relaxed text-parchment/85">
          {chapter.text(context).map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}
    </Dialog>
  );
}

/** Тихая печать в зале: новая глава ждёт, пока её откроют. Ничего не требует и сама не всплывает. */
export function SagaSeal() {
  const { saga, readChapter } = useGame();
  const [open, setOpen] = useState<SagaChapter | null>(null);
  const unread = saga.filter((c) => c.readAt === null).flatMap((c) => sagaChapter(c.key) ?? []);
  const first = unread[0];

  return (
    <>
      {first && (
        <Panel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
          <p className="text-sm text-parchment/80">
            Новая глава сказа: <span className="font-display text-base text-gold-bright">«{first.title}»</span>
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setOpen(first);
              readChapter(first.key);
            }}
          >
            Читать
          </Button>
        </Panel>
      )}
      <Reader
        chapter={open}
        onClose={() => {
          setOpen(null);
        }}
      />
    </>
  );
}

/** Архив сказа в окне героя: все открытые главы и сколько дней до следующей. */
export function SagaArchive() {
  const { saga, days, settings, readChapter } = useGame();
  const [open, setOpen] = useState<SagaChapter | null>(null);
  const opened = new Set(saga.map((c) => c.key));
  const unread = new Set(saga.filter((c) => c.readAt === null).map((c) => c.key));
  const chapters = SAGA.filter((ch) => opened.has(ch.key));
  const next = nextChapterIn(journeyDays(days), settings.sagaEveryDays);

  return (
    <Panel className="p-6">
      <PanelTitle className="mb-1 text-xl">Сказ о герое</PanelTitle>
      <p className="mb-4 text-sm text-parchment/65">
        {next === null
          ? "Первый том сказа дописан до конца."
          : `Следующая глава через ${String(next)} ${daysWord(next)} в походе. Подряд не обязательно.`}
      </p>
      {chapters.length === 0 ? (
        <p className="text-sm text-parchment/70">Сказ начнётся, когда наберутся первые дни в походе.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {chapters.map((ch) => (
            <li key={ch.key}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-baseline gap-3 rounded px-1 py-1 text-left hover:text-gold-bright"
                onClick={() => {
                  setOpen(ch);
                  readChapter(ch.key);
                }}
              >
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-parchment/60">{chapterNumber(ch)}</span>
                <span className="font-display text-base">{ch.title}</span>
                {unread.has(ch.key) && <span className="text-xs text-gold">новая</span>}
              </button>
            </li>
          ))}
        </ol>
      )}
      <Reader
        chapter={open}
        onClose={() => {
          setOpen(null);
        }}
      />
    </Panel>
  );
}

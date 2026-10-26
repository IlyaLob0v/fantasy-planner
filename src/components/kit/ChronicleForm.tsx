import { useState } from "react";

import { MOOD_LABEL } from "@/app/strings";
import { blankChronicle, isBlank, MOODS } from "@/domain/chronicle";
import type { ChronicleEntry, GameDate } from "@/domain/types";
import { useGame } from "@/services/game";

import { Chip } from "./pickers";
import { Button } from "../ui/button";
import { Textarea } from "../ui/input";

const label = "flex flex-col gap-1 text-xs text-parchment/60";

const FIELDS: ReadonlyArray<[keyof Pick<ChronicleEntry, "happened" | "noticed" | "feeling">, string, string]> = [
  ["happened", "Что произошло", "Сдал отчёт, позвонил маме"],
  ["noticed", "Что заметил", "Утром работается легче"],
  ["feeling", "Что чувствую", "Усталость, но приятная"],
];

/** Три коротких поля и настроение. Хроника не даёт наград и никогда не напоминает о себе повторно. */
export function ChronicleForm({ date, onDone }: { date: GameDate; onDone: () => void }) {
  const { chronicle, saveChronicle } = useGame();
  const [draft, setDraft] = useState<ChronicleEntry>(() => chronicle.find((e) => e.gameDate === date) ?? blankChronicle(date));
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaving(true);
        saveChronicle(draft)
          .then(onDone)
          .catch(() => {
            setSaving(false);
          });
      }}
    >
      {FIELDS.map(([key, title, hint], i) => (
        <label key={key} className={label}>
          {title}
          <Textarea
            autoFocus={i === 0}
            className="min-h-16"
            maxLength={2000}
            placeholder={hint}
            value={draft[key]}
            onChange={(e) => {
              setDraft((d) => ({ ...d, [key]: e.target.value }));
            }}
          />
        </label>
      ))}
      <div className={label}>
        Настроение
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Настроение">
          {MOODS.map((m) => (
            <Chip
              key={m}
              role="radio"
              aria-checked={draft.mood === m}
              active={draft.mood === m}
              onClick={() => {
                setDraft((d) => ({ ...d, mood: d.mood === m ? null : m }));
              }}
            >
              {MOOD_LABEL[m]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Отмена
        </Button>
        <Button type="submit" size="sm" disabled={saving || isBlank(draft)}>
          Записать
        </Button>
      </div>
    </form>
  );
}

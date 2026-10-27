import { useState } from "react";

import { SCHEDULE_LABEL, xpText } from "@/app/strings";
import { Coin } from "@/components/kit/icons";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { AttributePicker, Chip, DifficultyPicker } from "@/components/kit/pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ritualReward } from "@/domain/rewards";
import {
  WEEKDAY_SHORT,
  blankRitual,
  describeSchedule,
  isPaused,
  prepareRitual,
  ritualFieldsOf,
  ritualProblem,
} from "@/domain/rituals";
import { addDays, humanDate } from "@/domain/time";
import { RITUAL_SCHEDULES, type Ritual, type RitualFields } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

const label = "flex flex-col gap-1 text-xs text-parchment/60";

function clampInt(raw: string, min: number, max: number): number {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
}

function RitualForm({ ritual, onDone }: { ritual: Ritual | null; onDone: () => void }) {
  const { saveRitual, archiveRitual, today, rituals, settings, character } = useGame();
  const [draft, setDraft] = useState<RitualFields>(() => (ritual ? ritualFieldsOf(ritual) : blankRitual(today, rituals.length)));
  const [saving, setSaving] = useState(false);
  const problem = ritualProblem(draft);
  const reward = ritualReward(draft, settings, character.windStep);

  const set = <K extends keyof RitualFields>(key: K, value: RitualFields[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const save = () => {
    if (problem) return;
    setSaving(true);
    saveRitual(ritual?.id ?? null, prepareRitual(ritual, draft, today))
      .then(onDone)
      .catch(() => {
        setSaving(false);
      });
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className={label}>
        Название обета
        <Input
          autoFocus
          value={draft.title}
          placeholder="Утренний поход к колодцу"
          onChange={(e) => {
            set("title", e.target.value);
          }}
        />
      </label>
      <label className={label}>
        В жизни это
        <Input
          value={draft.realName ?? ""}
          placeholder="стакан воды после пробуждения"
          onChange={(e) => {
            set("realName", e.target.value || null);
          }}
        />
      </label>
      <div className="flex gap-4">
        <div className={label}>
          Атрибут
          <AttributePicker
            value={draft.attribute}
            onChange={(a) => {
              set("attribute", a);
            }}
          />
        </div>
        <div className={label}>
          Сложность
          <DifficultyPicker
            value={draft.difficulty}
            onChange={(d) => {
              set("difficulty", d);
            }}
          />
        </div>
      </div>

      <div className={label}>
        Расписание
        <div className="flex flex-wrap gap-1">
          {RITUAL_SCHEDULES.map((s) => (
            <Chip
              key={s}
              active={draft.schedule === s}
              onClick={() => {
                setDraft((d) => ({
                  ...d,
                  schedule: s,
                  weekdaysMask: d.weekdaysMask ?? (s === "weekdays" ? 0b0011111 : null),
                  timesPerWeek: d.timesPerWeek ?? (s === "times_per_week" ? 3 : null),
                  intervalDays: d.intervalDays ?? (s === "every_n_days" ? 2 : null),
                }));
              }}
            >
              {SCHEDULE_LABEL[s]}
            </Chip>
          ))}
        </div>
      </div>

      {draft.schedule === "weekdays" && (
        <div className="flex gap-1" aria-label="Дни недели">
          {WEEKDAY_SHORT.map((day, i) => {
            const bit = 1 << i;
            const active = ((draft.weekdaysMask ?? 0) & bit) !== 0;
            return (
              <Chip
                key={day}
                active={active}
                className="w-9 px-0"
                onClick={() => {
                  set("weekdaysMask", (draft.weekdaysMask ?? 0) ^ bit);
                }}
              >
                {day}
              </Chip>
            );
          })}
        </div>
      )}
      {draft.schedule === "times_per_week" && (
        <label className={cn(label, "w-40")}>
          Раз в неделю, в любые дни
          <Input
            type="number"
            min={1}
            max={6}
            value={draft.timesPerWeek ?? 3}
            onChange={(e) => {
              set("timesPerWeek", clampInt(e.target.value, 1, 6));
            }}
          />
        </label>
      )}
      {draft.schedule === "every_n_days" && (
        <label className={cn(label, "w-40")}>
          Интервал, дней
          <Input
            type="number"
            min={2}
            max={30}
            value={draft.intervalDays ?? 2}
            onChange={(e) => {
              set("intervalDays", clampInt(e.target.value, 2, 30));
            }}
          />
        </label>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <Chip
          active={draft.pausedUntil !== null}
          onClick={() => {
            set("pausedUntil", draft.pausedUntil === null ? addDays(today, 6) : null);
          }}
        >
          {draft.pausedUntil === null ? "Поставить на паузу" : "На паузе"}
        </Chip>
        {draft.pausedUntil !== null && (
          <label className={cn(label, "w-44")}>
            до (включительно)
            <Input
              type="date"
              min={today}
              value={draft.pausedUntil}
              onChange={(e) => {
                if (e.target.value) set("pausedUntil", e.target.value);
              }}
            />
          </label>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-sm text-parchment/70">
        Награда: {xpText(reward.xp)}, <Coin className="h-4 w-4" /> {reward.gold}
      </p>
      {ritual && prepareRitual(ritual, draft, today).startDate !== ritual.startDate && (
        <p className="text-xs text-parchment/45">Новое расписание начнёт действовать с сегодняшнего дня.</p>
      )}

      <div className="flex items-center justify-between gap-2">
        {ritual ? (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => {
              archiveRitual(ritual.id);
              onDone();
            }}
          >
            Снять обет
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Отмена
          </Button>
          <Button type="submit" size="sm" disabled={problem !== null || saving} title={problem ?? undefined}>
            {ritual ? "Сохранить" : "Принять обет"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** Правая панель Тронного зала: все ритуалы и их редактор. */
export function RitualsDrawer({ onClose }: { onClose: () => void }) {
  const { rituals, today } = useGame();
  const [editing, setEditing] = useState<Ritual | "new" | null>(rituals.length === 0 ? "new" : null);

  return (
    <Panel className="flex max-h-full min-h-0 flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <PanelTitle>{editing === null ? "Ритуалы" : editing === "new" ? "Новый обет" : "Свиток обета"}</PanelTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Закрыть
        </Button>
      </div>
      <div className="min-h-0 overflow-y-auto scrollbar-quiet">
        {editing !== null ? (
          <RitualForm
            key={editing === "new" ? "new" : editing.id}
            ritual={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
            }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {rituals.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(r);
                    }}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-parchment/10 bg-ink-deep/35 px-3 py-2.5 text-left transition-colors hover:border-gold/30"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] text-parchment">{r.title}</span>
                      {r.realName && <span className="block truncate text-xs text-parchment/45">{r.realName}</span>}
                    </span>
                    <span className="shrink-0 text-right text-xs text-parchment/55">
                      {isPaused(r, today) && r.pausedUntil ? `пауза до ${humanDate(r.pausedUntil)}` : describeSchedule(r)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => {
                setEditing("new");
              }}
            >
              + Ритуал
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

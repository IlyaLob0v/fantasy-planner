import { useState, type ReactNode } from "react";

import { assets } from "@/assets/registry";
import { CloseIcon } from "@/components/kit/icons";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { Chip } from "@/components/kit/pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Rate, Settings as GameSettings } from "@/domain/types";
import { useGame } from "@/services/game";

const DAY_START_HOURS = [0, 1, 2, 3, 4, 5, 6] as const;

const RATE_ROWS: ReadonlyArray<[keyof GameSettings["rates"], string]> = [
  ["side", "Побочный квест"],
  ["main", "Главный квест"],
  ["stage", "Этап босса"],
  ["bossDefeat", "Победа над боссом"],
  ["ritual", "Ритуал"],
  ["restAction", "Привал"],
];

/** Числовое поле, которое сохраняет значение при уходе фокуса или Enter, а не на каждую цифру. */
function NumberField({ value, min, label, onCommit }: { value: number; min: number; label: string; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const n = Math.round(Number(text));
    if (!Number.isFinite(n) || n < min) {
      setText(String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };
  return (
    <Input
      type="number"
      min={min}
      aria-label={label}
      className="w-20 tabular-nums"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h3 className="font-display text-xl text-parchment">{title}</h3>
        {hint && <p className="text-xs text-parchment/50">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Rates() {
  const { settings, saveRates } = useGame();
  const update = (key: keyof GameSettings["rates"], patch: Partial<Rate>) => {
    saveRates({ ...settings.rates, [key]: { ...settings.rates[key], ...patch } });
  };
  return (
    <table className="w-full max-w-md text-sm">
      <thead>
        <tr className="text-left text-xs text-parchment/45">
          <th className="pb-1 font-normal">Дело</th>
          <th className="pb-1 font-normal">XP</th>
          <th className="pb-1 font-normal">Золото</th>
        </tr>
      </thead>
      <tbody>
        {RATE_ROWS.map(([key, title]) => {
          const rate = settings.rates[key];
          return (
            <tr key={key}>
              <td className="py-1 pr-3 text-parchment/80">{title}</td>
              <td className="py-1 pr-3">
                <NumberField
                  key={rate.xp}
                  label={`${title}: XP`}
                  value={rate.xp}
                  min={0}
                  onCommit={(xp) => {
                    update(key, { xp });
                  }}
                />
              </td>
              <td className="py-1">
                <NumberField
                  key={rate.gold}
                  label={`${title}: золото`}
                  value={rate.gold}
                  min={0}
                  onCommit={(gold) => {
                    update(key, { gold });
                  }}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function RestActions() {
  const { restActions, addRestAction, archiveRestAction } = useGame();
  const [title, setTitle] = useState("");
  return (
    <div className="flex max-w-md flex-col gap-2">
      <ul className="flex flex-col gap-1">
        {restActions.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 rounded-[var(--radius-panel)] bg-ink-deep/35 px-3 py-1.5 text-sm text-parchment/85">
            {a.title}
            <button
              type="button"
              aria-label={`Убрать: ${a.title}`}
              className="cursor-pointer text-parchment/40 hover:text-parchment"
              disabled={restActions.length <= 1}
              onClick={() => {
                archiveRestAction(a.id);
              }}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const clean = title.trim();
          if (!clean) return;
          addRestAction(clean);
          setTitle("");
        }}
      >
        <Input
          value={title}
          placeholder="Выпить чаю у окна"
          aria-label="Новый привал"
          onChange={(e) => {
            setTitle(e.target.value);
          }}
        />
        <Button type="submit" size="sm" variant="outline" disabled={!title.trim()} className="h-9">
          Добавить
        </Button>
      </form>
    </div>
  );
}

/** Настройки: ставки, граница суток, цена отдыха, анимации, привалы и авторы иллюстраций. */
export function SettingsScreen() {
  const { settings, setSetting } = useGame();
  const origins = [
    ...new Set(Object.values(assets).map(({ credit }) => `${credit.author}, ${credit.year} · ${credit.license} · ${credit.source}`)),
  ];

  return (
    <div className="h-full overflow-y-auto p-6 scrollbar-quiet">
      <Panel className="mx-auto flex max-w-3xl flex-col gap-7 p-6">
        <PanelTitle>Устав гильдии</PanelTitle>

        <Section title="Начало суток" hint="Дела после полуночи и до этого часа засчитываются вчерашнему дню.">
          <div className="flex flex-wrap gap-1">
            {DAY_START_HOURS.map((h) => (
              <Chip
                key={h}
                active={settings.dayStartHour === h}
                className="tabular-nums"
                onClick={() => {
                  setSetting("day_start_hour", h);
                }}
              >
                {String(h).padStart(2, "0")}:00
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Ставки наград" hint="Базовая награда за дело сложности ✦. Сложность ✦✦ и ✦✦✦ умножают её на 2 и 3.">
          <Rates />
        </Section>

        <Section title="День отдыха" hint="Цена в лавке. Купленный день не прерывает серию.">
          <div className="flex items-center gap-2 text-sm text-parchment/70">
            <NumberField
              key={settings.restPrice}
              label="Цена дня отдыха"
              value={settings.restPrice}
              min={1}
              onCommit={(n) => {
                setSetting("rest_price", n);
              }}
            />
            зол.
          </div>
        </Section>

        <Section title="Анимации" hint="Сдержанные: без полёта монет, награда видна сразу. Системная настройка «уменьшить движение» тоже учитывается.">
          <div className="flex gap-1">
            <Chip
              active={settings.motion === "full"}
              onClick={() => {
                setSetting("motion", "full");
              }}
            >
              Полные
            </Chip>
            <Chip
              active={settings.motion === "reduced"}
              onClick={() => {
                setSetting("motion", "reduced");
              }}
            >
              Сдержанные
            </Chip>
          </div>
        </Section>

        <Section title="Привалы" hint="Короткие дела, которые герой предлагает, когда устал.">
          <RestActions />
        </Section>

        <Section title="Иллюстрации" hint="Откуда взялись сцены, которые висят на стенах гильдии.">
          <ul className="flex flex-col gap-1 text-sm text-parchment/70">
            {Object.values(assets).map(({ name, credit }) => (
              <li key={name}>
                <span className="text-parchment">{name}:</span> «{credit.title}»
              </li>
            ))}
          </ul>
          {origins.map((origin) => (
            <p key={origin} className="text-xs text-parchment/45">
              {origin}
            </p>
          ))}
        </Section>
      </Panel>
    </div>
  );
}

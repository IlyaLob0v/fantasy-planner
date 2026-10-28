import { useState, type ReactNode } from "react";

import { assets } from "@/assets/registry";
import { CloseIcon } from "@/components/kit/icons";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { Chip } from "@/components/kit/pickers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Rate, Settings as GameSettings } from "@/domain/types";
import { isMobile } from "@/app/platform";
import { useGame } from "@/services/game";
import { useExport } from "@/services/export";
import { useSaveReminder } from "@/services/reminder";

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

function ExportButtons() {
  const { state, exportData, exportChronicle } = useExport();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" disabled={state === "saving"} onClick={exportData}>
        Выгрузить летопись
      </Button>
      <Button size="sm" variant="outline" disabled={state === "saving"} onClick={exportChronicle}>
        Хроника в Markdown
      </Button>
      {state === "saved" && <span className="text-xs text-parchment/65">Сохранено</span>}
    </div>
  );
}

const GUIDE: ReadonlyArray<readonly [string, string]> = [
  ["Квесты", "Главный — важное, можно поставить срок. Побочный — рутина. Босс — большой проект из этапов, у него есть запас сил, который тает с каждым этапом."],
  ["Опыт и уровень", "Каждое дело даёт опыт. Уровень открывает титулы и путь к новым локациям."],
  ["Золото", "Падает за дела. Тратится в лавке: свои награды, день отдыха, локации. За бездействие не отнимается никогда."],
  ["Атрибуты", "Сила, Интеллект, Ловкость растут от дел своей категории и отражают, чем ты занимаешься."],
  ["Серия и Попутный ветер", "Серия — дни подряд хотя бы с одним делом. Каждые 7 дней серии дают +10 % золота, до +30 %."],
  ["Усталость", "Приходит после дня без дел. Ничего не отнимает; одно любое дело её снимает."],
  ["Зал славы", "Достижения за серии, подвиги, боссов и уровни. Каждое даёт немного золота и не отбирается."],
  ["Снаряжение", "Находки падают за квесты и ритуалы. Шанс растёт с каждым промахом, на 15-м деле подряд находка гарантирована, дублей нет. Свойство предмета работает, пока он надет."],
  ["Кузница", "Обычные и редкие вещи можно купить по фиксированной цене. Эпические и легендарные только находят или получают за главные вехи."],
  ["Неделя гильдии", "В начале недели гильдия ставит до трёх целей, чуть выше твоих прошлых недель. Цель можно заменить или убрать. За цель золото, за все сразу сундук с предметом. Невыполненная цель просто уходит."],
  ["Летопись недели", "В новую неделю в зале появляется итог прошлой: дела, лучший день, находки и строки хроники. Закрывается одним кликом."],
  ["Дни в походе", "Каждый день хотя бы с одним делом. Считаются за всё время, подряд не обязательно, и никогда не сгорают. Весь путь виден в Книге подвигов в окне героя."],
  ["Возвращение странника", "После перерыва зал встречает итогами пути и одним лёгким делом. Ничего не потеряно: золото, опыт и находки на месте."],
  ["Что было вчера?", "Если вчера в зале не отмечено ни одного дела, утром можно отметить забытые ритуалы и квесты. Награда и серия будут на месте, находки за прошлое не падают."],
  ["Комната в таверне", "Бесплатная пауза на 1–30 суток: болезнь, отпуск, тяжёлая неделя. Без дел эти дни серию не растят и не рвут, усталость не приходит, напоминания молчат. Вернуться можно раньше."],
  ["Чек-лист", "У главного и побочного квеста до 10 пунктов. Пункт сам ничего не даёт, но каждые 3 отмеченных прибавляют квесту 10 % опыта и золота, до +30 %."],
  ["Метки", "Одна метка на квест: «Работа», «Дом», «Учёба». На доске квестов можно оставить только квесты одной метки."],
  ["Сказ о герое", "История героя главами: новая глава каждые несколько дней в походе (по умолчанию 5), всего 24. Тихая печать в зале и архив в окне героя."],
  ["Герб гильдии", "Щит, фигура и поле. По одной части даётся даром, остальные продаёт геральдист по фиксированной цене. Герб стоит в заголовке окна."],
];

type LootNumber = "basePct" | "stepPct" | "pity" | "dailyCap";

const LOOT_FIELDS: ReadonlyArray<readonly [LootNumber, string, number]> = [
  ["basePct", "Шанс находки, %", 1],
  ["stepPct", "Прибавка за промах, %", 0],
  ["pity", "Гарантия на деле №", 1],
  ["dailyCap", "Находок в сутки, не больше", 1],
];

function lootJson(loot: GameSettings["loot"]) {
  return {
    base_pct: loot.basePct,
    step_pct: loot.stepPct,
    pity: loot.pity,
    daily_cap: loot.dailyCap,
    weights: loot.weights,
    unlock_level: loot.unlockLevel,
  };
}

function LootSettings() {
  const { settings, setSetting } = useGame();
  const { loot, forgePrices } = settings;
  return (
    <div className="grid gap-2 text-sm text-parchment/70 sm:grid-cols-2">
      {LOOT_FIELDS.map(([key, title, min]) => (
        <label key={key} className="flex items-center justify-between gap-2">
          {title}
          <NumberField
            key={loot[key]}
            label={title}
            value={loot[key]}
            min={min}
            onCommit={(n) => {
              setSetting("loot", lootJson({ ...loot, [key]: n }));
            }}
          />
        </label>
      ))}
      {(["common", "rare"] as const).map((rarity) => (
        <label key={rarity} className="flex items-center justify-between gap-2">
          {rarity === "common" ? "Кузнец: обычный предмет" : "Кузнец: редкий предмет"}
          <NumberField
            key={forgePrices[rarity]}
            label={`Цена у кузнеца: ${rarity}`}
            value={forgePrices[rarity]}
            min={1}
            onCommit={(n) => {
              setSetting("forge_prices", { ...forgePrices, [rarity]: n });
            }}
          />
        </label>
      ))}
    </div>
  );
}

type WeekNumber = "goalGold" | "chestGold" | "stretchPct";

const WEEK_FIELDS: ReadonlyArray<readonly [WeekNumber, string, number]> = [
  ["goalGold", "Золото за цель недели", 0],
  ["chestGold", "Золото в сундуке недели", 0],
  ["stretchPct", "Цель выше средней, %", 0],
];

function WeekSettings() {
  const { settings, setSetting } = useGame();
  const { week } = settings;
  const json = (next: GameSettings["week"]) => ({ goal_gold: next.goalGold, chest_gold: next.chestGold, stretch_pct: next.stretchPct });
  return (
    <div className="grid gap-2 text-sm text-parchment/70 sm:grid-cols-2">
      {WEEK_FIELDS.map(([key, title, min]) => (
        <label key={key} className="flex items-center justify-between gap-2">
          {title}
          <NumberField
            key={week[key]}
            label={title}
            value={week[key]}
            min={min}
            onCommit={(n) => {
              setSetting("week", json({ ...week, [key]: n }));
            }}
          />
        </label>
      ))}
      <label className="flex items-center justify-between gap-2">
        Часть герба
        <NumberField
          key={settings.crestPrice}
          label="Цена части герба"
          value={settings.crestPrice}
          min={1}
          onCommit={(n) => {
            setSetting("crest_price", n);
          }}
        />
      </label>
    </div>
  );
}

const JOURNEY_FIELDS: ReadonlyArray<readonly [keyof GameSettings["journey"], string, number]> = [
  ["returnAfterDays", "Встречать после стольких дней без дел", 1],
  ["staleOffer", "Предлагать разобрать день от стольких квестов", 1],
];

function JourneySettings() {
  const { settings, setSetting } = useGame();
  const { journey } = settings;
  const json = (next: GameSettings["journey"]) => ({ return_after_days: next.returnAfterDays, stale_offer: next.staleOffer });
  return (
    <div className="grid gap-2 text-sm text-parchment/70">
      {JOURNEY_FIELDS.map(([key, title, min]) => (
        <label key={key} className="flex items-center justify-between gap-2">
          {title}
          <NumberField
            key={journey[key]}
            label={title}
            value={journey[key]}
            min={min}
            onCommit={(n) => {
              setSetting("journey", json({ ...journey, [key]: n }));
            }}
          />
        </label>
      ))}
      <label className="flex items-center justify-between gap-2">
        Глава сказа каждые столько дней в походе
        <NumberField
          key={settings.sagaEveryDays}
          label="Глава сказа каждые столько дней в походе"
          value={settings.sagaEveryDays}
          min={1}
          onCommit={(n) => {
            setSetting("saga_every_days", n);
          }}
        />
      </label>
    </div>
  );
}

const WEEKDAY_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"] as const;

function ReminderSettings() {
  const { settings } = useGame();
  const save = useSaveReminder();
  const { reminder } = settings;
  const toggleDay = (day: number) => {
    const quiet = reminder.quietWeekdays.includes(day) ? reminder.quietWeekdays.filter((d) => d !== day) : [...reminder.quietWeekdays, day].sort();
    save({ ...reminder, quietWeekdays: quiet });
  };
  return (
    <div className="flex flex-col gap-3 text-sm text-parchment/70">
      <div className="flex flex-wrap gap-2">
        <Chip
          active={!reminder.enabled}
          onClick={() => {
            save({ ...reminder, enabled: false });
          }}
        >
          Выключено
        </Chip>
        <Chip
          active={reminder.enabled}
          onClick={() => {
            save({ ...reminder, enabled: true });
          }}
        >
          Включено
        </Chip>
      </div>
      {reminder.enabled && (
        <>
          <label className="flex items-center justify-between gap-2">
            Час напоминания
            <NumberField
              key={reminder.hour}
              label="Час напоминания"
              value={reminder.hour}
              min={0}
              onCommit={(n) => {
                save({ ...reminder, hour: Math.min(23, n) });
              }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1">Тихие дни:</span>
            {WEEKDAY_SHORT.map((label, day) => {
              const quiet = reminder.quietWeekdays.includes(day);
              return (
                <Chip
                  key={label}
                  active={quiet}
                  onClick={() => {
                    toggleDay(day);
                  }}
                >
                  {label}
                </Chip>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div>
        <h3 className="font-display text-xl text-parchment">{title}</h3>
        {hint && <p className="text-xs text-parchment/65">{hint}</p>}
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
        <tr className="text-left text-xs text-parchment/60">
          <th className="pb-1 font-normal">Дело</th>
          <th className="pb-1 font-normal">Опыт</th>
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
                  label={`${title}: опыт`}
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
              className="cursor-pointer text-parchment/60 hover:text-parchment"
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
    <div className="h-full overflow-y-auto p-3 scrollbar-quiet md:p-6">
      <Panel className="mx-auto flex max-w-3xl flex-col gap-7 p-4 md:p-6">
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

        <Section title="Находки и кузница" hint="Шанс растёт с каждым делом без находки, на пороге находка гарантирована. Шанс за золото не продаётся.">
          <LootSettings />
        </Section>

        <Section title="Неделя гильдии и герб" hint="Цели подбираются по последним четырём неделям. Сундук открывается, когда выполнены все цели недели.">
          <WeekSettings />
        </Section>

        <Section title="Возвращение странника и сказ" hint="После перерыва зал встречает карточкой с итогами пути и одним лёгким делом. Квесты, застрявшие с прошлых дней, можно одним нажатием убрать в «Без даты». Главы сказа открываются по дням в походе.">
          <JourneySettings />
        </Section>

        <Section
          title="Напоминание"
          hint={
            isMobile
              ? "Одно уведомление в выбранный час, только если за день ещё ничего не сделано. Приходит, даже если приложение закрыто."
              : "Одно уведомление в выбранный час, только если за день ещё ничего не сделано. На ПК приходит, пока приложение открыто или свёрнуто."
          }
        >
          <ReminderSettings />
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

        <Section title="Летопись" hint="Твои данные принадлежат тебе. Летопись в JSON хранит всё: квесты, журнал наград, ритуалы, хронику. Хроника в Markdown читается в любом редакторе.">
          <ExportButtons />
        </Section>

        <Section title="Справочник гильдии" hint="Как устроен мир, коротко.">
          <dl className="flex flex-col gap-2 text-sm text-parchment/75">
            {GUIDE.map(([term, text]) => (
              <div key={term}>
                <dt className="text-parchment">{term}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
          <button
            type="button"
            className="cursor-pointer self-start text-xs text-parchment/65 hover:text-gold-bright"
            onClick={() => {
              setSetting("hints_seen", []);
            }}
          >
            Показать подсказки заново
          </button>
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
            <p key={origin} className="text-xs text-parchment/60">
              {origin}
            </p>
          ))}
        </Section>
      </Panel>
    </div>
  );
}

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Attribute, RitualFields } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

interface Preset {
  title: string;
  realName: string;
  attribute: Attribute;
}

/** Готовые обеты для первого дня; свои ритуалы задаются потом в редакторе. */
const PRESETS: readonly Preset[] = [
  { title: "Утренняя молитва", realName: "зарядка", attribute: "strength" },
  { title: "Тренировка с мечом", realName: "спорт", attribute: "strength" },
  { title: "Чтение свитков", realName: "20 минут чтения", attribute: "intellect" },
  { title: "Вечерний дозор", realName: "план на завтра", attribute: "intellect" },
  { title: "Порядок в казарме", realName: "уборка 10 минут", attribute: "agility" },
  { title: "Глоток из родника", realName: "стакан воды", attribute: "agility" },
];

const MAX_PRESETS = 3;

type Step = "name" | "rituals" | "quest";
const STEPS: readonly Step[] = ["name", "rituals", "quest"];

const STEP_TITLE: Record<Step, string> = {
  name: "Как зовут героя?",
  rituals: "Какие обеты взять?",
  quest: "Первый приказ",
};

const STEP_HINT: Record<Step, string> = {
  name: "Имя будет на панели героя и в летописи.",
  rituals: `Ритуалы — ежедневные привычки. Выбери до ${String(MAX_PRESETS)}, свои добавишь потом.`,
  quest: "Что сделать сегодня? За выполненный квест дают опыт и золото.",
};

/** Присяга гильдии: три шага при первом запуске, каждый можно пропустить. Без слайдов обучения. */
export function Oath() {
  const { settings, character, today, renameCharacter, saveRitual, createQuest, finishOath } = useGame();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState(character.name);
  const [chosen, setChosen] = useState<string[]>([]);
  const [quest, setQuest] = useState("");
  const [closed, setClosed] = useState(false);

  if (settings.oathDone || closed) return null;

  const close = () => {
    setClosed(true);
    finishOath();
  };
  const index = STEPS.indexOf(step);
  const next = () => {
    const following = STEPS[index + 1];
    if (following) setStep(following);
    else close();
  };

  const accept = () => {
    if (step === "name" && name.trim() && name.trim() !== character.name) {
      renameCharacter(name.trim());
    }
    if (step === "rituals") {
      PRESETS.filter((p) => chosen.includes(p.title)).forEach((p, i) => {
        const fields: RitualFields = {
          title: p.title,
          realName: p.realName,
          attribute: p.attribute,
          schedule: "daily",
          weekdaysMask: null,
          timesPerWeek: null,
          intervalDays: null,
          startDate: today,
          pausedUntil: null,
          difficulty: 1,
          sortOrder: i,
        };
        void saveRitual(null, fields);
      });
    }
    if (step === "quest" && quest.trim()) {
      void createQuest({
        type: "side",
        title: quest.trim(),
        description: null,
        attribute: "agility",
        difficulty: 1,
        scheduledDate: today,
        dueDate: null,
        sortOrder: 0,
        parentId: null,
        damage: 1,
      });
    }
    next();
  };

  const toggle = (title: string) => {
    setChosen((list) => (list.includes(title) ? list.filter((t) => t !== title) : list.length < MAX_PRESETS ? [...list, title] : list));
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title="Присяга гильдии"
      description={`Шаг ${String(index + 1)} из ${String(STEPS.length)}. ${STEP_HINT[step]}`}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          accept();
        }}
      >
        <p className="font-display text-xl text-parchment">{STEP_TITLE[step]}</p>
        {step === "name" && (
          <Input
            autoFocus
            value={name}
            maxLength={40}
            onChange={(e) => {
              setName(e.target.value);
            }}
            aria-label="Имя героя"
          />
        )}
        {step === "rituals" && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map((p) => {
              const on = chosen.includes(p.title);
              return (
                <li key={p.title}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      toggle(p.title);
                    }}
                    className={cn(
                      "w-full cursor-pointer rounded-[var(--radius-panel)] border px-3 py-2 text-left transition-colors",
                      on ? "border-gold bg-gold/15" : "border-parchment/15 hover:border-gold/40",
                    )}
                  >
                    <span className="block text-sm text-parchment">{p.title}</span>
                    <span className="block text-xs text-parchment/50">{p.realName}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {step === "quest" && (
          <Input
            autoFocus
            value={quest}
            maxLength={200}
            placeholder="Например: разобрать почту"
            onChange={(e) => {
              setQuest(e.target.value);
            }}
            aria-label="Первый квест"
          />
        )}
        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={next}>
            Пропустить
          </Button>
          <Button type="submit" size="sm">
            {index === STEPS.length - 1 ? "Принести присягу" : "Дальше"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

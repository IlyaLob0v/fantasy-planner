import { daysWord, plural } from "@/app/strings";
import { deedsTotal, journeyDays, smallStep, staleQuests, weakestBoss } from "@/domain/journey";
import { locationState } from "@/domain/locations";
import { fieldsOf } from "@/domain/quests";
import { useGame } from "@/services/game";

import { Button } from "../ui/button";
import { Panel, PanelTitle } from "./Panel";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl leading-none text-gold-bright tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-parchment/55">{label}</p>
    </div>
  );
}

/** Ближайшая цель: босс при последнем издыхании или следующая локация на карте мира. */
function useNearestGoal(): string | null {
  const { quests, locations, character, inventory } = useGame();
  const boss = weakestBoss(quests);
  if (boss) return `Босс «${boss.boss.title}»: осталось ${String(boss.hp)} HP`;
  const next = [...locations]
    .sort((a, b) => a.unlockLevel - b.unlockLevel)
    .find((l) => {
      const state = locationState(l, character, inventory);
      return state === "available" || state === "locked";
    });
  if (!next) return null;
  return character.level >= next.unlockLevel
    ? `Локация «${next.name}» ждёт: ${String(next.price)} золота`
    : `Локация «${next.name}» откроется на ${String(next.unlockLevel)} уровне`;
}

/**
 * Возвращение странника: тёплая встреча после перерыва. Без упрёков и без слова «пропуск».
 * Показывается один раз на перерыв и исчезает, как только сделано первое дело.
 */
export function ReturnCard() {
  const { absence, closeReturn, clearStale, updateQuest, character, days, quests, today, settings } = useGame();
  const goal = useNearestGoal();
  if (!absence) return null;
  const step = smallStep(quests, today);
  const stale = staleQuests(quests, today);
  const stepToday = step !== null && step.scheduledDate !== null && step.scheduledDate <= today;

  return (
    <Panel className="p-5">
      <PanelTitle className="text-xl">С возвращением, {character.name}</PanelTitle>
      <p className="mt-1 text-sm text-parchment/70">
        Гильдия держала твоё место {absence.days} {daysWord(absence.days)}. Всё нажитое на месте, камин ждёт.
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        <Stat value={String(journeyDays(days))} label="дней в походе" />
        <Stat value={String(deedsTotal(days))} label="дел за всё время" />
        <Stat value={String(character.level)} label="уровень" />
      </div>
      <ul className="mt-4 flex flex-col gap-2 text-sm text-parchment/80">
        {goal && <li>Ближайшая цель: {goal}</li>}
        {step ? (
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>
              Начать с малого: «{step.title}»{stepToday && " уже ждёт в приказах на сегодня"}
            </span>
            {!stepToday && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  updateQuest(step.id, { ...fieldsOf(step), scheduledDate: today });
                }}
              >
                Взять на сегодня
              </Button>
            )}
          </li>
        ) : (
          <li>Начать с малого: привал у камина тоже считается делом.</li>
        )}
        {stale.length >= settings.journey.staleOffer && (
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>
              С прошлых дней ждут {stale.length} {plural(stale.length, "квест", "квеста", "квестов")}. Их можно убрать в «Без даты» и начать день с чистого листа.
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                clearStale(stale);
              }}
            >
              Убрать в «Без даты»
            </Button>
          </li>
        )}
      </ul>
      <Button variant="outline" size="sm" className="mt-4" onClick={closeReturn}>
        К делам
      </Button>
    </Panel>
  );
}

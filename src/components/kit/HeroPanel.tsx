import { useRef, useState } from "react";

import { GOLD_ANCHOR_ID } from "@/app/anchors";
import { ATTRIBUTE_HINT, ATTRIBUTE_LABEL, daysWord } from "@/app/strings";
import { nearestGlory } from "@/domain/achievements";
import { levelProgress } from "@/domain/levels";
import { windBonusPct, maxWindStep } from "@/domain/rewards";
import { nextWindIn } from "@/domain/streak";
import { ATTRIBUTES, type RestAction } from "@/domain/types";
import { useGame } from "@/services/game";

import { ATTRIBUTE_ICON, Coin } from "./icons";
import { Hearth } from "./Hearth";
import { OnceHint } from "./OnceHint";
import { Panel } from "./Panel";
import { Ribbon } from "./Ribbon";
import { XpBar } from "./XpBar";
import { Button } from "../ui/button";
import { Tooltip } from "../ui/tooltip";

function pick(actions: readonly RestAction[], except: number | null): RestAction | null {
  const pool = actions.filter((a) => a.id !== except);
  const source = pool.length > 0 ? pool : actions;
  return source[Math.floor(Math.random() * source.length)] ?? null;
}

function RestPrompt() {
  const { restActions, takeRest } = useGame();
  const [action, setAction] = useState<RestAction | null>(null);
  const doneRef = useRef<HTMLButtonElement>(null);

  if (!action) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={restActions.length === 0}
        onClick={() => {
          setAction(pick(restActions, null));
        }}
      >
        Сделать привал
      </Button>
    );
  }
  return (
    <div className="rounded-[var(--radius-panel)] border border-gold/30 bg-ink-deep/40 p-3">
      <p className="text-xs uppercase tracking-wider text-parchment/50">Привал</p>
      <p className="mt-0.5 font-display text-lg text-parchment">{action.title}</p>
      <div className="mt-2 flex gap-2">
        <Button
          ref={doneRef}
          size="sm"
          onClick={() => {
            takeRest(action, doneRef.current?.getBoundingClientRect() ?? null);
            setAction(null);
          }}
        >
          Сделано
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setAction(pick(restActions, action.id));
          }}
        >
          Другое
        </Button>
      </div>
    </div>
  );
}

/** Панель героя на главном экране: уровень, опыт, золото, атрибуты, серия, камин. */
export function HeroPanel() {
  const { character, settings, lastReward, glory } = useGame();
  const nearest = nearestGlory(glory);
  const progress = levelProgress(character.xp, settings.levelCurve);
  const fatigued = character.fatiguedSince !== null;
  const bonus = windBonusPct(character.windStep, settings.streakBonus);
  const windMaxed = character.windStep >= maxWindStep(settings.streakBonus);
  const untilWind = nextWindIn(character.streakCurrent, settings.streakBonus);

  return (
    <Panel className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-bright to-gold font-display text-3xl font-bold text-wood shadow-[0_0_20px_rgb(201_162_74/0.35)]">
          {progress.level}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl leading-tight text-parchment">{character.name}</h1>
          <p className="text-sm text-gold-bright/90">{character.title}</p>
          {fatigued && (
            <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-ember/50 bg-ember/15 px-2 py-0.5 text-xs text-ember">
              Усталость
            </span>
          )}
        </div>
        <Hearth lit={!fatigued} />
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs text-parchment/60">
          <span>Опыт</span>
          <span>
            {progress.into} / {progress.needed}
          </span>
        </div>
        <XpBar into={progress.into} needed={progress.needed} pulse={lastReward?.id ?? 0} />
      </div>

      <div className="flex items-center justify-between">
        <div id={GOLD_ANCHOR_ID} className="flex items-center gap-2">
          <Coin className="h-6 w-6" />
          <span className="font-display text-2xl text-gold-bright">{character.gold}</span>
          <span className="text-xs text-parchment/50">в сундуке</span>
        </div>
        {bonus > 0 ? (
          <Tooltip
            content={
              windMaxed
                ? "Попутный ветер на пике: +30 % золота"
                : `Попутный ветер: ещё ${untilWind} ${daysWord(untilWind)} серии до следующей ступени`
            }
          >
            <span className="cursor-default">
              <Ribbon tone="gold">⚑ +{bonus} %</Ribbon>
            </span>
          </Tooltip>
        ) : character.streakCurrent > 0 ? (
          <Tooltip content="Каждые 7 дней серии дают +10 % золота, до +30 %">
            <span className="cursor-default text-xs text-parchment/50">
              ⚑ ветер через {untilWind} {daysWord(untilWind)}
            </span>
          </Tooltip>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2">
        {ATTRIBUTES.map((a) => {
          const Icon = ATTRIBUTE_ICON[a];
          const value = character[a];
          return (
            <li key={a}>
              <Tooltip content={ATTRIBUTE_HINT[a]}>
                <div className="flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-gold/80" />
                  <span className="w-20 text-parchment/80">{ATTRIBUTE_LABEL[a]}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-deep/70">
                    <div className="h-full rounded-full bg-parchment/60" style={{ width: `${Math.min(100, (value % 50) * 2)}%` }} />
                  </div>
                  <span className="w-8 text-right tabular-nums text-parchment/70">{value}</span>
                </div>
              </Tooltip>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t border-gold/15 pt-3 text-sm">
        <span className="text-parchment/70">
          Серия: <span className="font-display text-lg text-gold-bright">{character.streakCurrent}</span>{" "}
          {daysWord(character.streakCurrent)}
        </span>
        <span className="text-xs text-parchment/50">лучшая {character.streakBest}</span>
      </div>

      {nearest && (
        <p className="-mt-2 text-xs text-parchment/55">
          Ближайшая слава: <span className="text-parchment/80">{nearest.def.title}</span>, {nearest.current} / {nearest.def.target}
        </p>
      )}

      {bonus > 0 && (
        <OnceHint id="wind">
          Попутный ветер: каждые 7 дней серии дают +10 % золота за дела, до +30 %. Пропуск опускает ветер на одну ступень, золото не отнимается.
        </OnceHint>
      )}

      {fatigued && (
        <div className="flex flex-col gap-2 border-t border-gold/15 pt-3">
          <p className="text-sm text-parchment/80">Герой просит привала. Одно дело вернёт силы.</p>
          <OnceHint id="fatigue">
            Усталость приходит после дня без дел. Это не штраф: ничего не отнимается, а любой квест, ритуал или привал сразу её снимает.
          </OnceHint>
          <RestPrompt />
        </div>
      )}
    </Panel>
  );
}

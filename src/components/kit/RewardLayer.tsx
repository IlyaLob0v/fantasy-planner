import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { RARITY_LABEL, xpText } from "@/app/strings";
import { titleForLevel } from "@/domain/levels";
import { unlockedBetween } from "@/domain/locations";
import { cn } from "@/lib/utils";
import { useGame, type RewardEvent } from "@/services/game";

import { Coin } from "./icons";
import { RARITY_FRAME } from "./rarity";
import { Button } from "../ui/button";


interface Flight {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  coins: number;
  xp: number;
}

function flightFor(event: RewardEvent): Flight | null {
  const { origin, target } = event;
  if (!origin || !target) {
    return null;
  }
  const card = {
    x: origin.left + origin.width / 2,
    y: origin.top + origin.height / 2,
  };
  const purse = {
    x: target.left + target.width / 2,
    y: target.top + target.height / 2,
  };
  return {
    id: event.id,
    from: event.direction === "in" ? card : purse,
    to: event.direction === "in" ? purse : card,
    coins:
      event.reward.gold > 0
        ? Math.min(10, Math.max(6, Math.ceil(event.reward.gold / 3)))
        : 0,
    xp: event.reward.xp,
  };
}

function CoinFlight({ flight }: { flight: Flight }) {
  return (
    <>
      {Array.from({ length: flight.coins }, (_, i) => {
        const spread = (i - flight.coins / 2) * 14;
        return (
          <motion.div
            key={i}
            className="pointer-events-none fixed left-0 top-0 z-50 h-5 w-5"
            initial={{
              x: flight.from.x - 10,
              y: flight.from.y - 10,
              scale: 0.6,
              opacity: 0,
            }}
            animate={{
              x: [
                flight.from.x - 10,
                flight.from.x - 10 + spread,
                flight.to.x - 10,
              ],
              y: [
                flight.from.y - 10,
                Math.max(48, Math.min(flight.from.y, flight.to.y) - 60 - Math.abs(spread)),
                flight.to.y - 10,
              ],
              scale: [0.6, 1, 0.7],
              opacity: [0, 1, 1, 0],
            }}
            transition={{ duration: 0.6, delay: i * 0.03, ease: "easeInOut" }}
          >
            <Coin className="h-5 w-5 drop-shadow-[0_0_6px_rgb(230_195_106/0.9)]" />
          </motion.div>
        );
      })}
      {flight.xp > 0 && (
        <motion.div
          className="pointer-events-none fixed left-0 top-0 z-50 font-display text-xl font-bold text-gold-bright drop-shadow-[0_0_8px_rgb(230_195_106/0.8)]"
          initial={{ x: flight.from.x + 24, y: flight.from.y - 12, opacity: 0 }}
          animate={{ y: flight.from.y - 52, opacity: [0, 1, 0] }}
          transition={{ duration: 1.2 }}
        >
          {xpText(flight.xp)}
        </motion.div>
      )}
    </>
  );
}

/** Слой наград поверх экрана: монеты, свечение XP, повышение уровня, отмена. */
export function RewardLayer({ onOpenMap }: { onOpenMap: () => void }) {
  const { lastReward, quests, undoQuest, settings, locations } = useGame();
  const calm = useReducedMotion() === true || settings.motion === "reduced";
  /** id последней награды, чьи части уже убраны с экрана. */
  const [flightDone, setFlightDone] = useState(0);
  const [levelDone, setLevelDone] = useState(0);
  const [undoDone, setUndoDone] = useState(0);

  const id = lastReward?.id ?? 0;
  const flight = lastReward && flightDone < id && !calm ? flightFor(lastReward) : null;
  const levelUp = lastReward && levelDone < id ? lastReward.levelUp : null;
  const victory = lastReward && levelDone < id ? lastReward.victory : null;
  const overlay = levelUp !== null || victory !== null;
  const opened = levelUp === null ? [] : unlockedBetween(locations, levelUp - 1, levelUp);
  const undoFor = lastReward && undoDone < id ? lastReward.questId : null;

  /** Оверлей победы или уровня закрывает тост отмены, поэтому окно отмены отсчитывается после него. */
  const undoWindow = lastReward && (lastReward.levelUp !== null || lastReward.victory !== null) ? 8000 : 5000;

  useEffect(() => {
    if (id === 0) return;
    const clearFlight = window.setTimeout(() => {
      setFlightDone(id);
    }, 1400);
    const clearUndo = window.setTimeout(() => {
      setUndoDone(id);
    }, undoWindow);
    return () => {
      window.clearTimeout(clearFlight);
      window.clearTimeout(clearUndo);
    };
  }, [id, undoWindow]);

  useEffect(() => {
    if (!overlay) return;
    const close = () => {
      setLevelDone(id);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const timer = window.setTimeout(close, 3000);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [overlay, id]);

  const undoQuestTarget =
    undoFor === null
      ? undefined
      : quests.find((q) => q.id === undoFor && q.status === "done");

  return (
    <>
      {flight && <CoinFlight key={flight.id} flight={flight} />}

      <AnimatePresence>
        {undoQuestTarget && (
          <motion.div
            className="fixed bottom-[calc(var(--bottom-chrome)+1.25rem)] right-5 z-40 flex items-center gap-3 rounded-[var(--radius-panel)] border border-gold/40 bg-wood/95 px-4 py-2.5 text-sm shadow-xl"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
          >
            <span className="text-parchment/80">Подвиг засчитан</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                undoQuest(undoQuestTarget);
                setUndoDone(id);
              }}
            >
              Отменить
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {overlay && (
          <motion.div
            role="dialog"
            aria-label={victory ? "Босс повержен" : "Новый уровень"}
            className="fixed inset-0 z-50 grid cursor-pointer place-items-center bg-ink-deep/75 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { delay: 0.6, duration: 0.3 } }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setLevelDone(id);
            }}
          >
            <motion.div
              className="text-center"
              initial={{ scale: 0.85, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 180, damping: 16 }}
            >
              {victory ? (
                <>
                  <p className="font-display text-5xl text-gold-bright drop-shadow-[0_0_24px_rgb(230_195_106/0.5)]">Босс повержен</p>
                  <p className="mt-1 text-lg text-parchment/80">{victory.boss.title}</p>
                  <div className={cn("mx-auto mt-5 w-72 rounded-[var(--radius-panel)] border-2 bg-wood/90 px-5 py-4", RARITY_FRAME[victory.loot.rarity])}>
                    <p className="text-xs uppercase tracking-wider text-parchment/65">Трофей · {RARITY_LABEL[victory.loot.rarity]}</p>
                    <p className="mt-1 font-display text-xl text-parchment">{victory.loot.itemName}</p>
                    <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-parchment/70">
                      {xpText(victory.reward.xp)} · <Coin className="h-4 w-4" /> {victory.reward.gold}
                    </p>
                  </div>
                  {levelUp !== null && <p className="mt-4 font-display text-2xl text-gold-bright">И новый уровень: {levelUp}</p>}
                </>
              ) : (
                levelUp !== null && (
                  <>
                    <div className="mx-auto mb-4 grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-gold-bright to-gold font-display text-5xl font-bold text-wood shadow-[0_0_60px_rgb(230_195_106/0.6)]">
                      {levelUp}
                    </div>
                    <p className="font-display text-4xl text-gold-bright">Новый уровень</p>
                    <p className="mt-1 text-lg text-parchment/80">
                      {titleForLevel(levelUp) === titleForLevel(levelUp - 1)
                        ? "Путь продолжается"
                        : `Отныне ты: ${titleForLevel(levelUp)}`}
                    </p>
                  </>
                )
              )}
              {opened.length > 0 && (
                <div className="mt-5">
                  <p className="text-parchment/75">Открыт путь: {opened.map((l) => l.name).join(", ")}</p>
                  <Button
                    className="mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLevelDone(id);
                      onOpenMap();
                    }}
                  >
                    Взглянуть
                  </Button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

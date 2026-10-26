import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { weekGoalDef } from "@/domain/week";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { RARITY_TEXT } from "./Equipment";
import { ChestIcon } from "./icons";

const SHOWN_MS = 2000;

/** Цель недели выполнена или открыт сундук: тост вверху окна на 2 с, клик закрывает. */
export function WeekToast() {
  const { lastWeek } = useGame();
  const [closedId, setClosedId] = useState<number | null>(null);

  useEffect(() => {
    if (!lastWeek) return;
    const timer = window.setTimeout(() => {
      setClosedId(lastWeek.id);
    }, SHOWN_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [lastWeek]);

  const visible = lastWeek !== null && closedId !== lastWeek.id;
  const labels = (lastWeek?.goals ?? []).flatMap((g) => weekGoalDef(g.goalKey)?.label(g.target) ?? []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          key={lastWeek.id}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          onClick={() => {
            setClosedId(lastWeek.id);
          }}
          className="fixed left-1/2 top-14 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-3 rounded-[var(--radius-panel)] border border-gold/40 bg-wood/95 px-4 py-2 text-left shadow-xl"
        >
          <ChestIcon className={cn("h-7 w-7", lastWeek.chest ? "text-gold-bright" : "text-parchment/60")} />
          <span>
            <span className="block text-xs uppercase tracking-wider text-parchment/50">{lastWeek.chest ? "Сундук недели" : "Цель недели"}</span>
            <span className="block font-display text-lg text-gold-bright">{labels.join(", ")}</span>
            <span className="block text-xs text-parchment/60">
              +{lastWeek.gold} золота
              {lastWeek.find && (
                <>
                  {" · "}
                  <span className={RARITY_TEXT[lastWeek.find.rarity]}>{lastWeek.find.name}</span>
                </>
              )}
            </span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { RARITY_LABEL } from "@/app/strings";
import { PERK_TEXT } from "@/domain/gear";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { RARITY_TEXT, SLOT_ICON } from "./Equipment";
import { RARITY_FRAME } from "./rarity";

const SHOWN_MS = 2000;

/** Находка снаряжения: карточка над тостом Зала славы на 2 с, клик закрывает. */
export function FindToast() {
  const { lastReward } = useGame();
  const [closedId, setClosedId] = useState<number | null>(null);
  const find = lastReward?.find ?? null;

  useEffect(() => {
    if (!lastReward?.find) return;
    const timer = window.setTimeout(() => {
      setClosedId(lastReward.id);
    }, SHOWN_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [lastReward]);

  const visible = lastReward !== null && find !== null && closedId !== lastReward.id;
  const Icon = find ? SLOT_ICON[find.slot] : null;

  return (
    <AnimatePresence>
      {visible && Icon && (
        <motion.button
          type="button"
          key={lastReward.id}
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.3 }}
          onClick={() => {
            setClosedId(lastReward.id);
          }}
          className={cn(
            "fixed bottom-[calc(var(--bottom-chrome)+6rem)] left-1/2 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-3 rounded-[var(--radius-panel)] border-2 bg-wood/95 px-4 py-2 text-left shadow-xl",
            RARITY_FRAME[find.rarity],
          )}
        >
          <Icon className={cn("h-8 w-8", RARITY_TEXT[find.rarity])} />
          <span>
            <span className="block text-xs uppercase tracking-wider text-parchment/50">Находка · {RARITY_LABEL[find.rarity]}</span>
            <span className={cn("block font-display text-lg", RARITY_TEXT[find.rarity])}>{find.name}</span>
            {find.perk && <span className="block text-xs text-parchment/60">{PERK_TEXT[find.perk]}</span>}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

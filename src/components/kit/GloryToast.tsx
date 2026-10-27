import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

import { gloryByKey, TIER_GOLD } from "@/domain/achievements";
import { useGame } from "@/services/game";

import { GlorySeal } from "./GlorySeal";

const SHOWN_MS = 2000;

/** Тихий тост о новых достижениях внизу окна: 2 с, закрывается кликом, не перекрывает монеты. */
export function GloryToast() {
  const { lastGlory } = useGame();
  const [closedId, setClosedId] = useState<number | null>(null);

  useEffect(() => {
    if (!lastGlory) return;
    const timer = window.setTimeout(() => {
      setClosedId(lastGlory.id);
    }, SHOWN_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [lastGlory]);

  const visible = lastGlory !== null && closedId !== lastGlory.id;
  const defs = (lastGlory?.keys ?? []).flatMap((k) => gloryByKey(k) ?? []);
  const first = defs[0];
  const gold = defs.reduce((sum, d) => sum + TIER_GOLD[d.tier], 0);

  return (
    <AnimatePresence>
      {visible && first && (
        <motion.button
          type="button"
          key={lastGlory.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.25 }}
          onClick={() => {
            setClosedId(lastGlory.id);
          }}
          className="fixed bottom-[calc(var(--bottom-chrome)+1.25rem)] left-1/2 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-3 rounded-[var(--radius-panel)] border border-gold/40 bg-wood/95 px-4 py-2 text-left shadow-xl"
        >
          <GlorySeal tier={first.tier} open />
          <span>
            <span className="block text-xs uppercase tracking-wider text-parchment/50">
              {defs.length > 1 ? `Зал славы: +${defs.length} достижения` : "Зал славы"}
            </span>
            <span className="block font-display text-lg text-gold-bright">
              {defs.length > 1 ? defs.map((d) => d.title).join(", ") : first.title}
            </span>
            <span className="block text-xs text-parchment/60">+{gold} золота</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { assets, locationAsset } from "@/assets/registry";
import { useGame } from "@/services/game";

/** Сколько туман держится над новой локацией; вместе с появлением и уходом укладывается в 2 с. */
const HOLD_MS = 1300;

/** Туман и имя новой локации при смене дома. Клик пропускает, сдержанные анимации отключают совсем. */
export function LocationVeil({ locationKey }: { locationKey: string }) {
  const { settings } = useGame();
  const calm = useReducedMotion() === true || settings.motion === "reduced";
  const [seen, setSeen] = useState(locationKey);
  const arriving = seen !== locationKey;

  useEffect(() => {
    if (!arriving) return;
    const timer = window.setTimeout(
      () => {
        setSeen(locationKey);
      },
      calm ? 0 : HOLD_MS,
    );
    return () => {
      window.clearTimeout(timer);
    };
  }, [arriving, calm, locationKey]);

  const name = assets[locationAsset(locationKey)].name;

  return (
    <AnimatePresence>
      {arriving && !calm && (
        <motion.button
          key={locationKey}
          type="button"
          aria-label={`Пропустить: ${name}`}
          className="fixed inset-0 z-40 grid cursor-pointer place-items-center bg-[radial-gradient(ellipse_at_center,rgba(232,220,192,0.55),rgba(46,32,24,0.92)_70%)] backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => {
            setSeen(locationKey);
          }}
        >
          <motion.span
            className="font-display text-5xl text-parchment drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
            initial={{ y: 12, opacity: 0, letterSpacing: "0.02em" }}
            animate={{ y: 0, opacity: 1, letterSpacing: "0.08em" }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            {name}
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

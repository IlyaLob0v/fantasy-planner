import { motion } from "motion/react";

import type { BossHp } from "@/domain/bosses";
import { cn } from "@/lib/utils";

/** Полоса HP босса: бордовая, тает с каждым пройденным этапом. */
export function HpBar({ hp, size = "md", className }: { hp: BossHp; size?: "sm" | "md"; className?: string }) {
  const pct = hp.max === 0 ? 0 : (hp.current / hp.max) * 100;
  return (
    <div
      role="meter"
      aria-label="Здоровье босса"
      aria-valuemin={0}
      aria-valuemax={hp.max}
      aria-valuenow={hp.current}
      className={cn("overflow-hidden rounded-full bg-ink-deep/70 ring-1 ring-burgundy/50", size === "sm" ? "h-1.5" : "h-3", className)}
    >
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-[#8a2a38] to-[#b0434f] shadow-[0_0_10px_rgb(176_67_79/0.6)]"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

/** Полоса опыта: наливается и вспыхивает свечением, когда растёт. */
export function XpBar({ into, needed, pulse, className }: { into: number; needed: number; pulse: number; className?: string }) {
  const pct = Math.min(100, Math.round((into / needed) * 100));
  return (
    <div className={cn("relative h-2.5 overflow-hidden rounded-full bg-ink-deep/70 ring-1 ring-gold/30", className)}>
      <motion.div
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold to-gold-bright"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      {pulse > 0 && (
        <motion.div
          key={pulse}
          className="absolute inset-0 rounded-full bg-gold-bright"
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.1 }}
          style={{ boxShadow: "0 0 18px 6px rgb(230 195 106 / 0.8)" }}
        />
      )}
    </div>
  );
}

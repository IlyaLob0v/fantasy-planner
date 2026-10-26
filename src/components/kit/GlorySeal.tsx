import type { GloryTier } from "@/domain/achievements";
import { cn } from "@/lib/utils";

/** Металл печати по ступени: медь, серебро, золото, звёздное золото. */
const TIER_METAL: Record<GloryTier, string> = {
  1: "from-[#b9794a] to-[#7a4a2a] border-[#d39a6a]",
  2: "from-[#d9d6cc] to-[#8f8c84] border-[#efece4]",
  3: "from-gold-bright to-gold border-gold-bright",
  4: "from-gold-bright to-[#b07a1e] border-gold-bright shadow-[0_0_16px_rgb(230_195_106/0.55)]",
};

/** Печать достижения. Закрытая печать — тёмный силуэт с тонким кольцом прогресса. */
export function GlorySeal({ tier, open, ratio = 0, className }: { tier: GloryTier; open: boolean; ratio?: number; className?: string }) {
  if (!open) {
    const deg = Math.round(Math.min(1, Math.max(0, ratio)) * 360);
    return (
      <span
        className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full p-[2px]", className)}
        style={{ background: `conic-gradient(var(--color-gold) ${deg}deg, rgb(232 220 192 / 0.12) 0)` }}
        aria-hidden
      >
        <span className="h-full w-full rounded-full bg-ink-deep/90" />
      </span>
    );
  }
  return (
    <span
      className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 bg-gradient-to-br font-display text-lg text-wood", TIER_METAL[tier], className)}
      aria-hidden
    >
      ✦
    </span>
  );
}

import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type Tone = "wood" | "parchment";

/** Полупрозрачная подложка с тонкой золотой линией: не спорит с иллюстрацией. */
export function Panel({ tone = "wood", className, ...props }: ComponentProps<"section"> & { tone?: Tone }) {
  return (
    <section
      className={cn(
        "grain rounded-[var(--radius-panel)] border shadow-[0_8px_30px_rgb(0_0_0/0.35)] backdrop-blur-[6px]",
        tone === "wood"
          ? "border-gold/35 bg-[var(--panel-wood)] text-parchment"
          : "border-wood/30 bg-[var(--panel-parchment)] text-wood",
        className,
      )}
      {...props}
    />
  );
}

export function PanelTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("font-display text-2xl leading-tight text-gold-bright", className)} {...props} />;
}

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Лента с ласточкиным хвостом: метки «Срок вышел», серия. */
export function Ribbon({ children, tone = "burgundy", className }: { children: ReactNode; tone?: "burgundy" | "gold"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 pr-3.5 text-xs font-medium [clip-path:polygon(0_0,100%_0,calc(100%-7px)_50%,100%_100%,0_100%)]",
        tone === "burgundy" ? "bg-burgundy text-parchment" : "bg-gold text-wood",
        className,
      )}
    >
      {children}
    </span>
  );
}

import type { CSSProperties } from "react";

import { assets, type AssetEntry, type AssetKey } from "@/assets/registry";
import { cn } from "@/lib/utils";

/** Иллюстрация сцены на всё окно + градиент к краям для читаемости панелей. */
export function SceneBackdrop({ asset, dim = 0, dusk = false }: { asset: AssetKey; dim?: number; dusk?: boolean }) {
  const entry: AssetEntry = assets[asset];
  const style: CSSProperties = {
    filter: dusk ? "saturate(0.72) brightness(0.82) sepia(0.12)" : "none",
    transition: "filter 1.5s ease",
  };
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0" style={style}>
        <img
          src={entry.src}
          alt=""
          className="h-full w-full object-cover"
          style={{ objectPosition: `${entry.focus.x}% ${entry.focus.y}%` }}
        />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgb(0_0_0/0.55)_100%)]" />
      <div
        className={cn(
          "absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgb(90_40_20/0.5)_100%)] transition-opacity duration-[1500ms]",
          dusk ? "opacity-100" : "opacity-0",
        )}
      />
      {dim > 0 && <div className="absolute inset-0 bg-ink-deep" style={{ opacity: dim }} />}
    </div>
  );
}

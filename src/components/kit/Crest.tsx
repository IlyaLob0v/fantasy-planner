import { useId } from "react";

import type { CrestChoice } from "@/domain/crest";
import { cn } from "@/lib/utils";

const SHIELD: Record<string, string> = {
  heater: "M4 4h32v16c0 13-8 21-16 25C12 41 4 33 4 20Z",
  round: "M20 5a19 19 0 1 1 0 38a19 19 0 1 1 0-38Z",
  kite: "M20 3c9 0 16 3 16 3c0 18-6 30-16 40C10 36 4 24 4 6c0 0 7-3 16-3Z",
  banner: "M6 3h28v41l-14-8-14 8Z",
};

function star(cx: number, cy: number, outer: number, inner: number): string {
  const points = Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${points.join("L")}Z`;
}

/** Фигуры герба: несколько контуров на фигуру, окна и прорези вырезаются правилом evenodd. */
const CHARGE: Record<string, readonly string[]> = {
  tower: [
    "M13.5 34V20.5l-1.5-1.5v-5h3v2h2.2v-2h2.6v2h2.2v-2h2.6v2h2.2v-2h3v5l-1.5 1.5V34h-4.6v-4a2.4 2.4 0 0 0-4.8 0v4Z M19 21.5h2v3.5h-2Z",
    "M11 34h18v1.6H11Z",
  ],
  star: [star(20, 23, 10, 4.2)],
  oak: [
    "M19.2 34v-5.5h-3.6a6 6 0 0 1-1.6-11.7a6 6 0 0 1 12 0a6 6 0 0 1-1.6 11.7h-3.6V34Z",
    "M16.5 34h7v1.6h-7Z",
  ],
  key: ["M20 11a5.5 5.5 0 0 1 1 10.9V34h-2v-2h-3v-2h3v-2h-2v-2h2v-4.1A5.5 5.5 0 0 1 20 11Zm0 3a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5Z"],
  moon: ["M24 12a11 11 0 1 0 0 22a9 9 0 1 1 0-22Z"],
  sword: [
    "M20 8.5l1.7 3.2V27h-3.4V11.7Z",
    "M14 27h12a1 1 0 0 1 0 2.2H14a1 1 0 0 1 0-2.2Z",
    "M18.7 29.2h2.6v4.6h-2.6Z",
    "M20 33.4a1.9 1.9 0 1 1 0 3.8a1.9 1.9 0 1 1 0-3.8Z",
  ],
};

export const TINCTURE: Record<string, string> = {
  burgundy: "#6b1e2a",
  blue: "#1e3550",
  wood: "#2e2018",
  gold: "#c9a24a",
  silver: "#e8dcc0",
};

/** Светлый блик в центре поля, чтобы щит выглядел выпуклым, а не плоской заливкой. */
const TINCTURE_LIGHT: Record<string, string> = {
  burgundy: "#9a3343",
  blue: "#34557d",
  wood: "#4a3426",
  gold: "#ecd08a",
  silver: "#fbf6ea",
};

const LIGHT = new Set(["gold", "silver"]);

/** Герб гильдии: щит с золотой каймой, поле с бликом и фигура. Рисуется SVG, без иллюстраций. */
export function Crest({ choice, className, title }: { choice: CrestChoice; className?: string; title?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const light = LIGHT.has(choice.tincture);
  const shield = SHIELD[choice.shield] ?? SHIELD["heater"];
  const charge = CHARGE[choice.charge] ?? CHARGE["tower"] ?? [];
  const field = TINCTURE[choice.tincture] ?? TINCTURE["burgundy"];
  const glow = TINCTURE_LIGHT[choice.tincture] ?? TINCTURE_LIGHT["burgundy"];
  const rim = `${id}-rim`;
  const fill = `${id}-field`;
  const metal = `${id}-metal`;
  return (
    <svg viewBox="0 0 40 48" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={rim} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e2a0" />
          <stop offset="0.5" stopColor="#c9a24a" />
          <stop offset="1" stopColor="#9c6f24" />
        </linearGradient>
        <radialGradient id={fill} cx="0.4" cy="0.3" r="0.85">
          <stop offset="0" stopColor={glow} />
          <stop offset="1" stopColor={field} />
        </radialGradient>
        <linearGradient id={metal} x1="0" y1="0" x2="0" y2="1">
          {light ? (
            <>
              <stop offset="0" stopColor="#4a3426" />
              <stop offset="1" stopColor="#1e140e" />
            </>
          ) : (
            <>
              <stop offset="0" stopColor="#f6e2a0" />
              <stop offset="1" stopColor="#b88a34" />
            </>
          )}
        </linearGradient>
      </defs>
      <path d={shield} fill={`url(#${fill})`} stroke={`url(#${rim})`} strokeWidth="2.4" strokeLinejoin="round" />
      <path d={shield} fill="none" stroke="#f6e2a0" strokeOpacity="0.3" strokeWidth="0.7" transform="translate(20 24) scale(0.84) translate(-20 -24)" />
      {charge.map((d) => (
        <path key={d} d={d} fill={`url(#${metal})`} fillRule="evenodd" stroke={light ? "#f6e2a0" : "#3a1f12"} strokeOpacity="0.35" strokeWidth="0.5" />
      ))}
    </svg>
  );
}

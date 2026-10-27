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

const CHARGE: Record<string, string> = {
  tower: "M12 33V17h3v-3h3v3h4v-3h3v3h3v16h-5v-5a3 3 0 0 0-6 0v5Z",
  star: star(20, 23, 10, 4.2),
  oak: "M19 34v-6h-3.5a6 6 0 0 1-1.5-11.6a6 6 0 0 1 12 0A6 6 0 0 1 24.5 28H21v6Z",
  key: "M20 11a5.5 5.5 0 0 1 1 10.9V34h-2v-2h-3v-2h3v-2h-2v-2h2v-4.1A5.5 5.5 0 0 1 20 11Zm0 3a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5Z",
  moon: "M24 12a11 11 0 1 0 0 22a9 9 0 1 1 0-22Z",
  sword: "M19 10l1-2 1 2v15h4v2h-4v3h1.5v3h-5v-3H19v-3h-4v-2h4Z",
};

export const TINCTURE: Record<string, string> = {
  burgundy: "#6b1e2a",
  blue: "#1e3550",
  wood: "#2e2018",
  gold: "#c9a24a",
  silver: "#e8dcc0",
};

const LIGHT = new Set(["gold", "silver"]);

/** Герб гильдии: щит, поле и фигура. Рисуется SVG, без иллюстраций. */
export function Crest({ choice, className, title }: { choice: CrestChoice; className?: string; title?: string }) {
  const light = LIGHT.has(choice.tincture);
  const ink = light ? "#2e2018" : "#c9a24a";
  return (
    <svg viewBox="0 0 40 48" className={cn("shrink-0", className)} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <path d={SHIELD[choice.shield] ?? SHIELD["heater"]} fill={TINCTURE[choice.tincture] ?? TINCTURE["burgundy"]} stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      <path d={CHARGE[choice.charge] ?? CHARGE["tower"]} fill={ink} fillRule="evenodd" />
    </svg>
  );
}

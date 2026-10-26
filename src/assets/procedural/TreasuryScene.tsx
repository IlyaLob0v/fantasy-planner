import { seeded } from "./random";

const rand = seeded(19);
const COINS = Array.from({ length: 90 }, () => {
  const spread = (rand() - 0.5) * 2;
  return {
    x: 800 + spread * 300,
    y: 830 - (1 - Math.abs(spread)) * 70 + rand() * 40,
    r: 9 + rand() * 6,
    o: 0.65 + rand() * 0.35,
  };
}).sort((a, b) => a.y - b.y);

const MOTES = Array.from({ length: 40 }, () => ({
  x: 560 + rand() * 480,
  y: 300 + rand() * 420,
  r: 0.8 + rand() * 1.6,
  o: 0.2 + rand() * 0.5,
}));

function vault(cx: number, width: number, top: number, bottom: number): string {
  const half = width / 2;
  return `M${cx - half},${bottom} L${cx - half},${top + half * 0.6} Q${cx - half},${top} ${cx},${top} Q${cx + half},${top} ${cx + half},${top + half * 0.6} L${cx + half},${bottom} Z`;
}

function Candle({ x, y, h }: { x: number; y: number; h: number }) {
  return (
    <g>
      <circle cx={x} cy={y - h - 14} r="70" fill="url(#tr-candle)" />
      <rect x={x - 7} y={y - h} width="14" height={h} rx="3" fill="#e8dcc0" opacity="0.85" />
      <path d={`M${x},${y - h - 24} C${x + 6},${y - h - 12} ${x + 5},${y - h - 4} ${x},${y - h - 2} C${x - 5},${y - h - 4} ${x - 6},${y - h - 12} ${x},${y - h - 24} Z`} fill="#ffd98a" />
    </g>
  );
}

/** «Сокровищница»: сводчатый подвал, сундук в свете свечей, россыпь монет. Собственная векторная сцена. */
export function TreasuryScene() {
  return (
    <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <defs>
        <radialGradient id="tr-glow" cx="0.5" cy="0.62" r="0.55">
          <stop offset="0" stopColor="#8a6430" />
          <stop offset="0.45" stopColor="#3d2a1c" />
          <stop offset="1" stopColor="#120c09" />
        </radialGradient>
        <radialGradient id="tr-candle" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd98a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tr-chest-light" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe6a8" stopOpacity="0.8" />
          <stop offset="1" stopColor="#c9a24a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tr-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a4426" />
          <stop offset="1" stopColor="#3a2414" />
        </linearGradient>
      </defs>

      <rect width="1600" height="1000" fill="url(#tr-glow)" />

      <path d={vault(800, 760, 120, 1000)} fill="#2a1c13" opacity="0.6" />
      <path d={vault(800, 560, 220, 1000)} fill="#4a3220" opacity="0.45" />
      <path d={vault(220, 420, 260, 1000)} fill="#1a110c" opacity="0.7" />
      <path d={vault(1380, 420, 260, 1000)} fill="#1a110c" opacity="0.7" />
      <path d="M0,0 H1600 V140 Q1200,40 800,120 Q400,40 0,140 Z" fill="#0e0907" />
      <rect x="0" y="0" width="70" height="1000" fill="#0e0907" />
      <rect x="1530" y="0" width="70" height="1000" fill="#0e0907" />
      <path d="M380,1000 L380,300 L430,300 L430,1000 Z M1170,1000 L1170,300 L1220,300 L1220,1000 Z" fill="#140d09" />

      <rect y="860" width="1600" height="140" fill="#160f0a" />
      <path d="M0,860 H1600" stroke="#3d2a1c" strokeWidth="2" />

      {MOTES.map((m, i) => (
        <circle key={i} cx={m.x} cy={m.y} r={m.r} fill="#ffe6a8" opacity={m.o} />
      ))}

      <ellipse cx="800" cy="700" rx="260" ry="200" fill="url(#tr-chest-light)" />

      <g>
        <rect x="660" y="690" width="280" height="150" rx="6" fill="url(#tr-wood)" />
        <path d="M660,700 Q660,600 800,600 Q940,600 940,700 Z" fill="#7a5030" />
        <path d="M660,700 Q660,640 800,612 Q940,640 940,700" fill="none" stroke="#c9a24a" strokeWidth="6" opacity="0.9" />
        <rect x="660" y="690" width="280" height="12" fill="#c9a24a" opacity="0.9" />
        <rect x="700" y="600" width="14" height="240" fill="#c9a24a" opacity="0.75" />
        <rect x="886" y="600" width="14" height="240" fill="#c9a24a" opacity="0.75" />
        <rect x="782" y="704" width="36" height="44" rx="4" fill="#c9a24a" />
        <circle cx="800" cy="722" r="6" fill="#2e2018" />
      </g>

      {COINS.map((c, i) => (
        <ellipse key={i} cx={c.x} cy={c.y} rx={c.r} ry={c.r * 0.45} fill="#c9a24a" stroke="#8a6a24" strokeWidth="1" opacity={c.o} />
      ))}

      <Candle x={520} y={860} h={90} />
      <Candle x={560} y={860} h={60} />
      <Candle x={1080} y={860} h={110} />
      <Candle x={1040} y={860} h={70} />

      <g opacity="0.85">
        <path d="M1240,860 L1260,700 H1360 L1380,860 Z" fill="#2a1c13" />
        <ellipse cx="1310" cy="700" rx="50" ry="10" fill="#3d2a1c" />
        <rect x="200" y="760" width="160" height="100" rx="4" fill="#2a1c13" />
        <path d="M200,770 Q200,720 280,720 Q360,720 360,770 Z" fill="#3a2618" />
      </g>
    </svg>
  );
}

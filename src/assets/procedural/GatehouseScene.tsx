import { seeded } from "./random";

const rand = seeded(7);
const STARS = Array.from({ length: 140 }, () => ({
  x: rand() * 1600,
  y: rand() * 420,
  r: 0.4 + rand() * 1.3,
  o: 0.25 + rand() * 0.6,
}));

function pines(seed: number, from: number, to: number, base: number, height: number): string {
  const r = seeded(seed);
  let d = "";
  for (let x = from; x < to; x += 18 + r() * 26) {
    const h = height * (0.6 + r() * 0.6);
    const w = h * (0.28 + r() * 0.08);
    d += `M${x - w / 2},${base} L${x},${base - h} L${x + w / 2},${base} Z `;
  }
  return d;
}

const PINES_BACK = pines(11, -40, 1680, 860, 150);
const PINES_LEFT = pines(23, -60, 420, 1000, 330);
const PINES_RIGHT = pines(31, 1240, 1700, 1000, 300);

function crenels(x: number, y: number, width: number, tooth = 14): string {
  let d = "";
  for (let i = x; i < x + width; i += tooth * 2) {
    d += `M${i},${y} h${tooth} v-${tooth} h-${tooth} Z `;
  }
  return d;
}

/** «Надвратная башня»: замок на холме в сумерках. Собственная векторная сцена. */
export function GatehouseScene() {
  return (
    <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="gh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1422" />
          <stop offset="0.45" stopColor="#1e3550" />
          <stop offset="0.72" stopColor="#5a2433" />
          <stop offset="0.86" stopColor="#b35a2c" />
          <stop offset="1" stopColor="#e09a4a" />
        </linearGradient>
        <radialGradient id="gh-moon" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f6e6b8" stopOpacity="0.9" />
          <stop offset="0.35" stopColor="#e6c36a" stopOpacity="0.25" />
          <stop offset="1" stopColor="#e6c36a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gh-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8dcc0" stopOpacity="0" />
          <stop offset="0.6" stopColor="#e8dcc0" stopOpacity="0.14" />
          <stop offset="1" stopColor="#e8dcc0" stopOpacity="0" />
        </linearGradient>
        <filter id="gh-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      <rect width="1600" height="1000" fill="url(#gh-sky)" />
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#f3ead2" opacity={s.o} />
      ))}
      <circle cx="560" cy="150" r="160" fill="url(#gh-moon)" />
      <circle cx="560" cy="150" r="38" fill="#f1e2b4" opacity="0.78" />

      <path d="M0,640 L140,560 L260,600 L420,500 L560,580 L700,520 L860,600 L1000,510 L1160,590 L1320,530 L1480,600 L1600,560 L1600,1000 L0,1000 Z" fill="#26304a" opacity="0.85" />
      <path d={PINES_BACK} fill="#1a2234" />
      <rect y="760" width="1600" height="140" fill="url(#gh-mist)" />

      <path d="M380,1000 C520,760 700,700 820,700 C960,700 1120,770 1260,1000 Z" fill="#121925" />

      <g fill="#0c1119">
        <rect x="660" y="520" width="320" height="200" />
        <path d={crenels(660, 520, 320)} />
        <rect x="610" y="420" width="90" height="300" />
        <path d={crenels(610, 420, 90, 15)} />
        <path d="M600,420 L655,330 L710,420 Z" />
        <rect x="940" y="400" width="96" height="320" />
        <path d={crenels(940, 400, 96, 16)} />
        <path d="M930,400 L988,300 L1046,400 Z" />
        <rect x="770" y="460" width="100" height="260" />
        <path d={crenels(770, 460, 100, 12.5)} />
        <rect x="815" y="380" width="10" height="82" />
        <path d="M825,382 L866,394 L825,408 Z" fill="#6b1e2a" />
      </g>
      <path d="M790,720 L790,640 A30,30 0 0 1 850,640 L850,720 Z" fill="#d9772b" opacity="0.55" />
      <g fill="#e6c36a">
        {[
          [640, 470],
          [668, 470],
          [975, 450],
          [1003, 450],
          [808, 520],
          [832, 520],
          [700, 580],
          [930, 590],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="9" height="16" rx="4" filter="url(#gh-glow)" opacity="0.9" />
            <rect x={x} y={y} width="9" height="16" rx="4" />
          </g>
        ))}
      </g>

      <path d={PINES_LEFT} fill="#070a10" />
      <path d={PINES_RIGHT} fill="#070a10" />
      <rect y="900" width="1600" height="100" fill="#06080c" opacity="0.6" />
    </svg>
  );
}

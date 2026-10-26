import { seeded } from "./random";

const rand = seeded(42);
const FOG = Array.from({ length: 9 }, (_, i) => ({
  cx: rand() * 1600,
  cy: 560 + i * 34 + rand() * 30,
  rx: 260 + rand() * 300,
  ry: 26 + rand() * 24,
  o: 0.18 + rand() * 0.22,
}));

/** «Странник»: фигура на утёсе над морем тумана на рассвете. Собственная векторная сцена. */
export function WandererScene() {
  return (
    <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="wd-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1e3550" />
          <stop offset="0.4" stopColor="#4c4a66" />
          <stop offset="0.66" stopColor="#c08a6a" />
          <stop offset="0.8" stopColor="#efc98a" />
          <stop offset="1" stopColor="#e8dcc0" />
        </linearGradient>
        <radialGradient id="wd-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff2cf" stopOpacity="0.95" />
          <stop offset="1" stopColor="#efc98a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#wd-sky)" />
      <circle cx="1080" cy="600" r="260" fill="url(#wd-sun)" />
      <path d="M0,640 L180,520 L300,580 L480,430 L640,560 L760,500 L900,590 L1100,470 L1260,560 L1440,480 L1600,560 L1600,1000 L0,1000 Z" fill="#7d7488" opacity="0.55" />
      <path d="M0,700 L220,610 L380,660 L560,590 L760,680 L980,610 L1200,690 L1400,620 L1600,680 L1600,1000 L0,1000 Z" fill="#5d5670" opacity="0.6" />
      {FOG.map((f, i) => (
        <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} fill="#f4ead3" opacity={f.o} />
      ))}
      <rect y="760" width="1600" height="240" fill="#efe4cb" opacity="0.35" />
      <path d="M0,1000 L0,760 C120,740 240,720 330,700 C380,690 420,660 470,650 C520,640 560,660 600,700 C660,760 720,850 760,1000 Z" fill="#1d1712" />
      <path d="M470,650 C478,620 486,600 492,560 C495,540 505,528 515,528 C527,528 533,540 534,556 C537,600 545,624 556,652 Z" fill="#120e0b" />
      <circle cx="514" cy="520" r="15" fill="#120e0b" />
      <path d="M497,522 C496,500 532,500 531,522 L527,534 L501,534 Z" fill="#120e0b" />
      <path d="M541,640 L572,470" stroke="#120e0b" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

import castleDeparture from "./illustrations/castle-departure.webp";
import monasteryCellar from "./illustrations/monastery-cellar.webp";
import pineForestMorning from "./illustrations/pine-forest-morning.webp";
import wandererFog from "./illustrations/wanderer-fog.webp";

/** Цветовые токены, выведенные из доминирующих цветов иллюстрации. */
export interface SceneTheme {
  tint: string;
  panelWood: string;
  panelParchment: string;
}

/** Происхождение картины: показывается в списке кредитов. */
export interface Credit {
  title: string;
  author: string;
  year: string;
  license: string;
  source: string;
}

export interface AssetEntry {
  /** Название места в мире приложения (titlebar, карта). */
  name: string;
  src: string;
  /** Точка кадрирования в процентах: что не должно обрезаться. */
  focus: { x: number; y: number };
  theme: SceneTheme;
  credit: Credit;
}

const PUBLIC_DOMAIN = "Общественное достояние";

/** Единый слой ассетов: экраны знают только ключи. */
export const assets = {
  "location.gatehouse": {
    name: "Замок на холме",
    src: castleDeparture,
    focus: { x: 55, y: 42 },
    theme: { tint: "#1f1a10", panelWood: "rgb(47 40 27 / 0.84)", panelParchment: "rgb(228 224 206 / 0.9)" },
    credit: {
      title: "Отъезд (The Departure)",
      author: "Томас Коул",
      year: "1837",
      license: `${PUBLIC_DOMAIN} (CC0, Национальная галерея искусства, Вашингтон)`,
      source: "https://commons.wikimedia.org/wiki/File:Thomas_Cole,_The_Departure,_1837,_NGA_166439.jpg",
    },
  },
  "location.forest": {
    name: "Сосновый бор",
    src: pineForestMorning,
    focus: { x: 45, y: 55 },
    theme: { tint: "#182019", panelWood: "rgb(40 38 26 / 0.84)", panelParchment: "rgb(226 220 194 / 0.9)" },
    credit: {
      title: "Утро в сосновом лесу",
      author: "Иван Шишкин, Константин Савицкий",
      year: "1889",
      license: PUBLIC_DOMAIN,
      source: "https://commons.wikimedia.org/wiki/File:Shishkin,_Ivan_-_Morning_in_a_Pine_Forest.jpg",
    },
  },
  hero: {
    name: "Странник над туманом",
    src: wandererFog,
    focus: { x: 50, y: 42 },
    theme: { tint: "#23232a", panelWood: "rgb(41 34 25 / 0.84)", panelParchment: "rgb(230 226 218 / 0.9)" },
    credit: {
      title: "Странник над морем тумана",
      author: "Каспар Давид Фридрих",
      year: "1818",
      license: PUBLIC_DOMAIN,
      source: "https://commons.wikimedia.org/wiki/File:Caspar_David_Friedrich_-_Wanderer_above_the_Sea_of_Fog.jpeg",
    },
  },
  treasury: {
    name: "Погреб гильдии",
    src: monasteryCellar,
    focus: { x: 50, y: 50 },
    theme: { tint: "#1b160b", panelWood: "rgb(46 37 19 / 0.86)", panelParchment: "rgb(236 224 184 / 0.9)" },
    credit: {
      title: "В монастырском погребе",
      author: "Эдуард фон Грютцнер",
      year: "1878",
      license: PUBLIC_DOMAIN,
      source: "https://commons.wikimedia.org/wiki/File:Eduard_von_Gr%C3%BCtzner_Im_Klosterkeller_1878.jpg",
    },
  },
} satisfies Record<string, AssetEntry>;

export type AssetKey = keyof typeof assets;

function isAssetKey(key: string): key is AssetKey {
  return key in assets;
}

export function locationAsset(locationKey: string): AssetKey {
  const key = `location.${locationKey}`;
  return isAssetKey(key) ? key : "location.gatehouse";
}

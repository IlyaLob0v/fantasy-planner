import dragonLair from "./illustrations/dragon-lair.webp";
import forest from "./illustrations/forest.webp";
import gatehouse from "./illustrations/gatehouse.webp";
import goblinMarket from "./illustrations/goblin-market.webp";
import hero from "./illustrations/hero.webp";
import tavern from "./illustrations/tavern.webp";
import treasury from "./illustrations/treasury.webp";

/** Цветовые токены, выведенные из доминирующих цветов иллюстрации. */
export interface SceneTheme {
  tint: string;
  panelWood: string;
  panelParchment: string;
}

/** Происхождение картинки: показывается в списке кредитов. */
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

/** Арт сгенерирован для проекта по библии стиля (specs/art-bible.md). */
function ownArt(title: string): Credit {
  return {
    title,
    author: "Штаб гильдии",
    year: "2026",
    license: "Собственный арт проекта",
    source: "Leonardo.ai (Lucid Origin), увеличение Real-ESRGAN ×2",
  };
}

/** Единый слой ассетов: экраны знают только ключи. */
export const assets = {
  "location.gatehouse": {
    name: "Надвратная башня",
    src: gatehouse,
    focus: { x: 47, y: 40 },
    theme: { tint: "#0b1620", panelWood: "rgb(25 29 34 / 0.86)", panelParchment: "rgb(230 224 206 / 0.9)" },
    credit: ownArt("Надвратная башня гильдии"),
  },
  "location.forest": {
    name: "Сосновый бор",
    src: forest,
    focus: { x: 45, y: 65 },
    theme: { tint: "#12171c", panelWood: "rgb(28 42 43 / 0.84)", panelParchment: "rgb(228 228 200 / 0.9)" },
    credit: ownArt("Лагерь следопытов в сосновом бору"),
  },
  "location.tavern": {
    name: "Таверна «Пьяный грифон»",
    src: tavern,
    focus: { x: 40, y: 50 },
    theme: { tint: "#140d0c", panelWood: "rgb(57 35 21 / 0.86)", panelParchment: "rgb(240 222 188 / 0.9)" },
    credit: ownArt("Таверна «Пьяный грифон»"),
  },
  "location.goblin_market": {
    name: "Гоблинский рынок",
    src: goblinMarket,
    focus: { x: 60, y: 45 },
    theme: { tint: "#080a0b", panelWood: "rgb(16 28 30 / 0.86)", panelParchment: "rgb(222 228 214 / 0.9)" },
    credit: ownArt("Гоблинский рынок на болоте"),
  },
  "location.dragon_lair": {
    name: "Логово дракона",
    src: dragonLair,
    focus: { x: 50, y: 60 },
    theme: { tint: "#0b0e12", panelWood: "rgb(47 39 29 / 0.86)", panelParchment: "rgb(230 222 200 / 0.9)" },
    credit: ownArt("Логово дракона в старой шахте"),
  },
  hero: {
    name: "Рыцарь-странник",
    src: hero,
    focus: { x: 35, y: 45 },
    theme: { tint: "#14171e", panelWood: "rgb(56 52 50 / 0.84)", panelParchment: "rgb(240 226 196 / 0.9)" },
    credit: ownArt("Рыцарь-странник над морем облаков"),
  },
  treasury: {
    name: "Казна гильдии",
    src: treasury,
    focus: { x: 50, y: 45 },
    theme: { tint: "#130e13", panelWood: "rgb(44 30 26 / 0.86)", panelParchment: "rgb(234 222 196 / 0.9)" },
    credit: ownArt("Казна гильдии"),
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

/** Запись реестра по ключу из базы (например, asset_key локации); null, если такого арта нет. */
export function assetByKey(key: string): AssetEntry | null {
  return isAssetKey(key) ? assets[key] : null;
}

/**
 * Портрет героя меняется каждые 10 уровней. Новый арт добавляется сюда записью со своим уровнем;
 * пока следующего портрета нет, остаётся последний доступный.
 */
export const HERO_PORTRAITS: ReadonlyArray<{ fromLevel: number; key: AssetKey }> = [{ fromLevel: 1, key: "hero" }];

export function heroPortrait(level: number): AssetKey {
  let key: AssetKey = "hero";
  for (const p of HERO_PORTRAITS) {
    if (level >= p.fromLevel) key = p.key;
  }
  return key;
}

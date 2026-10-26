import type { ComponentType } from "react";

import { GatehouseScene } from "./procedural/GatehouseScene";
import { TreasuryScene } from "./procedural/TreasuryScene";
import { WandererScene } from "./procedural/WandererScene";

export type AssetSource = { kind: "scene"; Scene: ComponentType } | { kind: "image"; src: string };

/** Цветовые токены, выведенные из доминирующих цветов иллюстрации. */
export interface SceneTheme {
  tint: string;
  panelWood: string;
  panelParchment: string;
}

export interface Credit {
  title: string;
  author: string;
  license: string;
}

export interface AssetEntry {
  source: AssetSource;
  /** Точка кадрирования в процентах: что не должно обрезаться. */
  focus: { x: number; y: number };
  theme: SceneTheme;
  credit: Credit;
}

const OWN_WORK = "Собственная векторная сцена приложения";

/** Единый слой ассетов: экраны знают только ключи. */
export const assets = {
  "location.gatehouse": {
    source: { kind: "scene", Scene: GatehouseScene },
    focus: { x: 52, y: 60 },
    theme: { tint: "#121f30", panelWood: "rgb(34 26 24 / 0.84)", panelParchment: "rgb(232 220 192 / 0.9)" },
    credit: { title: "Надвратная башня", author: "Штаб гильдии", license: OWN_WORK },
  },
  hero: {
    source: { kind: "scene", Scene: WandererScene },
    focus: { x: 32, y: 55 },
    theme: { tint: "#2a2a3a", panelWood: "rgb(40 30 26 / 0.84)", panelParchment: "rgb(232 220 192 / 0.9)" },
    credit: { title: "Странник над туманом", author: "Штаб гильдии", license: OWN_WORK },
  },
  treasury: {
    source: { kind: "scene", Scene: TreasuryScene },
    focus: { x: 50, y: 70 },
    theme: { tint: "#2a1c13", panelWood: "rgb(36 24 18 / 0.86)", panelParchment: "rgb(232 220 192 / 0.9)" },
    credit: { title: "Сокровищница", author: "Штаб гильдии", license: OWN_WORK },
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

import { NOTHING, spend, type TurnContext } from "./turns";
import type { CrestPart, Outcome, Settings } from "./types";

/** Герб гильдии: щит, фигура и цвет поля. По одной части каждого вида даётся даром, остальные покупаются. */

export const CREST_KINDS = ["shield", "charge", "tincture"] as const;
export type CrestKind = (typeof CREST_KINDS)[number];

export interface CrestPartDef {
  /** Стабильный ключ вида `shield.round`: по нему хранится покупка. */
  key: string;
  kind: CrestKind;
  id: string;
  name: string;
  free: boolean;
}

function part(kind: CrestKind, id: string, name: string, free = false): CrestPartDef {
  return { key: `${kind}.${id}`, kind, id, name, free };
}

export const CREST_PARTS: readonly CrestPartDef[] = [
  part("shield", "heater", "Треугольный щит", true),
  part("shield", "round", "Круглый щит"),
  part("shield", "kite", "Каплевидный щит"),
  part("shield", "banner", "Знамя"),

  part("charge", "tower", "Башня", true),
  part("charge", "star", "Звезда"),
  part("charge", "oak", "Дуб"),
  part("charge", "key", "Ключ"),
  part("charge", "moon", "Полумесяц"),
  part("charge", "sword", "Меч"),

  part("tincture", "burgundy", "Бордо", true),
  part("tincture", "blue", "Лазурь"),
  part("tincture", "wood", "Морёный дуб"),
  part("tincture", "gold", "Золото"),
  part("tincture", "silver", "Серебро"),
];

export const CREST_KIND_LABEL: Record<CrestKind, string> = {
  shield: "Щит",
  charge: "Фигура",
  tincture: "Поле",
};

export type CrestChoice = Settings["crest"];

export function crestPart(kind: CrestKind, id: string): CrestPartDef | undefined {
  return CREST_PARTS.find((p) => p.kind === kind && p.id === id);
}

export function ownsPart(def: CrestPartDef, bought: readonly CrestPart[]): boolean {
  return def.free || bought.some((b) => b.key === def.key);
}

function freePart(kind: CrestKind): string {
  return CREST_PARTS.find((p) => p.kind === kind && p.free)?.id ?? "";
}

/** Герб, который рисуется: выбранная часть, если она есть у гильдии, иначе дарованная. */
export function resolveCrest(choice: CrestChoice, bought: readonly CrestPart[]): CrestChoice {
  const pick = (kind: CrestKind) => {
    const def = crestPart(kind, choice[kind]);
    return def && ownsPart(def, bought) ? def.id : freePart(kind);
  };
  return { shield: pick("shield"), charge: pick("charge"), tincture: pick("tincture") };
}

export function planBuyCrestPart(ctx: TurnContext, def: CrestPartDef, bought: readonly CrestPart[]): Outcome {
  if (ownsPart(def, bought)) {
    throw new Error("Эта часть герба уже есть у гильдии");
  }
  const { character, entry } = spend(ctx, ctx.settings.crestPrice, "purchase", null, `Герб: ${def.name}`);
  return { ...NOTHING, ledger: [entry], days: [], character, crestParts: [{ key: def.key, uid: ctx.uid() }] };
}

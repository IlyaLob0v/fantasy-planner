import { useState, type ComponentType, type SVGProps } from "react";

import { RARITY_LABEL } from "@/app/strings";
import { assets, heroPortrait } from "@/assets/registry";
import { Button } from "@/components/ui/button";
import { bestEquipped, GEAR, gearByKey, PERK_TEXT, type GearDef } from "@/domain/gear";
import type { Gear, GearSlot } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { ArmorIcon, CloakIcon, HelmIcon, SwordIcon, TalismanIcon } from "./icons";
import { OnceHint } from "./OnceHint";
import { Panel, PanelTitle } from "./Panel";
import { RARITY_FRAME } from "./rarity";

export const SLOT_LABEL: Record<GearSlot, string> = {
  weapon: "Оружие",
  helm: "Шлем",
  armor: "Доспех",
  cloak: "Плащ",
  talisman: "Талисман",
};

export const SLOT_ICON: Record<GearSlot, ComponentType<SVGProps<SVGSVGElement>>> = {
  weapon: SwordIcon,
  helm: HelmIcon,
  armor: ArmorIcon,
  cloak: CloakIcon,
  talisman: TalismanIcon,
};

/** Цвет надписи предмета по редкости. */
export const RARITY_TEXT: Record<GearDef["rarity"], string> = {
  common: "text-parchment",
  rare: "text-[#8fb3dc]",
  epic: "text-[#e08a95]",
  legendary: "text-gold-bright",
};

/** Расположение слотов вокруг портрета: сетка 3×3, портрет в центре. */
const AROUND: ReadonlyArray<GearSlot | "portrait" | null> = [null, "helm", null, "weapon", "portrait", "talisman", null, "armor", "cloak"];

function SlotButton({ slot, item, active, onClick }: { slot: GearSlot; item: GearDef | null; active: boolean; onClick: () => void }) {
  const Icon = SLOT_ICON[slot];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex h-full min-h-20 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-panel)] border-2 bg-ink-deep/45 p-2 text-center transition-colors",
        item ? RARITY_FRAME[item.rarity] : "border-dashed border-parchment/15",
        active && "ring-2 ring-gold/70",
      )}
    >
      <Icon className={cn("h-6 w-6", item ? RARITY_TEXT[item.rarity] : "text-parchment/30")} />
      <span className={cn("line-clamp-2 text-[11px] leading-tight", item ? RARITY_TEXT[item.rarity] : "text-parchment/40")}>
        {item ? item.name : SLOT_LABEL[slot]}
      </span>
    </button>
  );
}

function Chooser({ slot, owned, equippedId }: { slot: GearSlot; owned: readonly Gear[]; equippedId: number | null }) {
  const { equip } = useGame();
  const options = owned.flatMap((g) => {
    const def = gearByKey(g.itemKey);
    return def && def.slot === slot ? [{ gear: g, def }] : [];
  });
  if (options.length === 0) {
    return <p className="text-sm text-parchment/55">Здесь пока пусто. Предметы находятся за дела, падают с боссов и продаются у кузнеца.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {options.map(({ gear, def }) => {
        const on = gear.id === equippedId;
        return (
          <li key={gear.id} className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-parchment/10 bg-ink-deep/35 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm", RARITY_TEXT[def.rarity])}>{def.name}</p>
              <p className="text-xs text-parchment/50">
                {RARITY_LABEL[def.rarity]}
                {def.relicOf !== null && " · реликвия"}
                {def.perk && ` · ${PERK_TEXT[def.perk]}`}
              </p>
            </div>
            <Button
              size="sm"
              variant={on ? "ghost" : "outline"}
              onClick={() => {
                equip(slot, on ? null : gear.id);
              }}
            >
              {on ? "Снять" : "Надеть"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

/** Облик героя: портрет и пять слотов вокруг; рамка портрета по лучшей надетой редкости. */
export function Equipment() {
  const { gear, equipment, character } = useGame();
  const [open, setOpen] = useState<GearSlot | null>(null);
  const portrait = assets[heroPortrait(character.level)];
  const best = bestEquipped(gear, equipment);
  const equippedOf = (slot: GearSlot) => equipment.find((e) => e.slot === slot)?.gearId ?? null;
  const defOf = (slot: GearSlot) => gearByKey(gear.find((g) => g.id === equippedOf(slot))?.itemKey ?? "") ?? null;

  return (
    <Panel className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <PanelTitle className="text-xl">Снаряжение</PanelTitle>
        <span className="text-sm text-parchment/60">
          {gear.length} / {GEAR.length}
        </span>
      </div>
      <div className="mx-auto grid max-w-sm grid-cols-3 gap-2">
        {AROUND.map((cell, i) =>
          cell === null ? (
            <div key={i} />
          ) : cell === "portrait" ? (
            <div
              key={i}
              className={cn("aspect-square overflow-hidden rounded-full border-2", best ? RARITY_FRAME[best] : "border-parchment/20")}
              style={{
                backgroundImage: `url(${portrait.src})`,
                backgroundSize: "cover",
                backgroundPosition: `${String(portrait.focus.x)}% ${String(portrait.focus.y)}%`,
              }}
              role="img"
              aria-label={portrait.name}
            />
          ) : (
            <SlotButton
              key={i}
              slot={cell}
              item={defOf(cell)}
              active={open === cell}
              onClick={() => {
                setOpen((s) => (s === cell ? null : cell));
              }}
            />
          ),
        )}
      </div>
      {open && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-xs uppercase tracking-wider text-parchment/45">{SLOT_LABEL[open]}</p>
          <Chooser slot={open} owned={gear} equippedId={equippedOf(open)} />
        </div>
      )}
      {gear.length > 0 && (
        <div className="mt-4">
          <OnceHint id="finds">
            Находки падают за квесты и ритуалы, чаще всего раз в 5–8 дел. Каждый промах повышает шанс, а на 15-м деле подряд находка гарантирована. Дублей
            не бывает, а редкие вещи открываются с уровнем. Свойство предмета работает, пока он надет.
          </OnceHint>
        </div>
      )}
    </Panel>
  );
}

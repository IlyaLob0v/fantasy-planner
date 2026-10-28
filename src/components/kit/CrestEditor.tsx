import { CREST_KIND_LABEL, CREST_KINDS, CREST_PARTS, ownsPart, type CrestPartDef } from "@/domain/crest";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { BuyButton } from "./BuyButton";
import { Crest, TINCTURE } from "./Crest";
import { Panel, PanelTitle } from "./Panel";

function PartChip({ def, chosen, onPick }: { def: CrestPartDef; chosen: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={onPick}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-[var(--radius-panel)] border px-2.5 py-1.5 text-sm transition-colors",
        chosen ? "border-gold bg-gold/15 text-gold-bright" : "border-parchment/15 text-parchment/75 hover:border-gold/50",
      )}
    >
      {def.kind === "tincture" && <span className="h-3.5 w-3.5 rounded-full ring-1 ring-gold/50" style={{ background: TINCTURE[def.id] }} />}
      {def.name}
    </button>
  );
}

/** Герб гильдии на экране героя: собранное выбирается кликом, новое покупается за фиксированную цену. */
export function CrestEditor() {
  const { crest, crestParts, character, settings, setCrest, buyCrestPart } = useGame();
  const owned = CREST_PARTS.filter((p) => ownsPart(p, crestParts));
  const forSale = CREST_PARTS.filter((p) => !ownsPart(p, crestParts));

  return (
    <Panel className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <PanelTitle className="text-xl">Герб гильдии</PanelTitle>
        <span className="text-sm text-parchment/70">
          {owned.length} / {CREST_PARTS.length}
        </span>
      </div>
      <div className="flex flex-col gap-5 sm:flex-row">
        <Crest choice={crest} className="mx-auto h-28 w-24 sm:mx-0" title="Герб гильдии" />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {CREST_KINDS.map((kind) => (
            <div key={kind}>
              <p className="mb-1.5 text-xs uppercase tracking-wider text-parchment/60">{CREST_KIND_LABEL[kind]}</p>
              <div className="flex flex-wrap gap-1.5">
                {owned
                  .filter((p) => p.kind === kind)
                  .map((p) => (
                    <PartChip
                      key={p.key}
                      def={p}
                      chosen={crest[kind] === p.id}
                      onPick={() => {
                        setCrest({ ...crest, [kind]: p.id });
                      }}
                    />
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {forSale.length > 0 && (
        <div className="mt-5 border-t border-gold/15 pt-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-parchment/60">У геральдиста</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {forSale.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-parchment/10 bg-ink-deep/35 px-3 py-1.5">
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  {p.kind === "tincture" && <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-gold/50" style={{ background: TINCTURE[p.id] }} />}
                  <span className="truncate">
                    <span className="text-parchment/60">{CREST_KIND_LABEL[p.kind]}:</span> {p.name}
                  </span>
                </span>
                <BuyButton
                  price={settings.crestPrice}
                  gold={character.gold}
                  onBuy={(origin) => {
                    buyCrestPart(p, origin);
                  }}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

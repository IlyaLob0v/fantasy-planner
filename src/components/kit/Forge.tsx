import { RARITY_LABEL } from "@/app/strings";
import { forgePrice, forgeStock, PERK_TEXT } from "@/domain/gear";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { BuyButton } from "./BuyButton";
import { RARITY_TEXT, SLOT_ICON, SLOT_LABEL } from "./Equipment";

/** Кузница: конкретные обычные и редкие предметы по фиксированной цене. Ни сундуков, ни шансов за золото. */
export function Forge() {
  const { gear, character, settings, perks, buyGear } = useGame();
  const stock = forgeStock(gear, character.level, settings.loot);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-parchment/70">
        Кузнец куёт обычные вещи и, с {settings.loot.unlockLevel.rare} уровня, редкие. Эпические и легендарные только находят в деле.
      </p>
      {stock.length === 0 ? (
        <p className="py-6 text-center text-sm text-parchment/65">Всё, что кузнец умеет, уже у тебя.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {stock.map((def) => {
            const Icon = SLOT_ICON[def.slot];
            const price = forgePrice(def, settings.forgePrices, perks);
            return (
              <li key={def.key} className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-parchment/10 bg-ink-deep/40 px-3 py-2.5">
                <Icon className={cn("h-6 w-6 shrink-0", RARITY_TEXT[def.rarity])} />
                <div className="min-w-0 flex-1">
                  <p className={cn("truncate text-sm", RARITY_TEXT[def.rarity])}>{def.name}</p>
                  <p className="text-xs text-parchment/65">
                    {SLOT_LABEL[def.slot]} · {RARITY_LABEL[def.rarity]}
                    {def.perk && ` · ${PERK_TEXT[def.perk]}`}
                  </p>
                </div>
                {price !== null && (
                  <BuyButton
                    price={price}
                    gold={character.gold}
                    onBuy={(origin) => {
                      buyGear(def, origin);
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

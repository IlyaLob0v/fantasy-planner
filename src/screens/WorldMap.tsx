import { assetByKey } from "@/assets/registry";
import { BuyButton } from "@/components/kit/BuyButton";
import { Ribbon } from "@/components/kit/Ribbon";
import { Button } from "@/components/ui/button";
import { locationState, type LocationState } from "@/domain/locations";
import type { Location } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

function LocationCard({ location, state }: { location: Location; state: LocationState }) {
  const { character, buyLocation, setHome } = useGame();
  const art = assetByKey(location.assetKey);
  const locked = state === "locked";

  return (
    <li className="overflow-hidden rounded-[var(--radius-panel)] border border-parchment/10 bg-ink-deep/40">
      <div className="relative aspect-[16/9] overflow-hidden bg-ink-deep">
        {art && (
          <img
            src={art.src}
            alt=""
            loading="lazy"
            className={cn("h-full w-full object-cover transition-[filter]", locked && "blur-[3px] brightness-[0.35] grayscale")}
            style={{ objectPosition: `${art.focus.x}% ${art.focus.y}%` }}
          />
        )}
        {state === "home" && <Ribbon tone="gold" className="absolute left-0 top-3">Дом</Ribbon>}
        {locked && (
          <p className="absolute inset-0 grid place-items-center font-display text-lg text-parchment/80">
            Откроется на {location.unlockLevel} уровне
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <p className={cn("font-display text-lg leading-tight", locked ? "text-parchment/65" : "text-parchment")}>{location.name}</p>
        {state === "available" && (
          <BuyButton
            price={location.price}
            gold={character.gold}
            onBuy={(origin) => {
              buyLocation(location, origin);
            }}
          />
        )}
        {state === "owned" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setHome(location.key);
            }}
          >
            Сделать домом
          </Button>
        )}
      </div>
    </li>
  );
}

/** Карта мира: закрытые локации силуэтом с уровнем, доступные с ценой, свои с кнопкой «Сделать домом». */
export function WorldMap() {
  const { locations, character, inventory } = useGame();
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-parchment/65">Уровень открывает путь, золото открывает ворота. Дом задаёт фон Тронного зала и доски квестов.</p>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {locations.map((l) => (
          <LocationCard key={l.key} location={l} state={locationState(l, character, inventory)} />
        ))}
      </ul>
    </div>
  );
}

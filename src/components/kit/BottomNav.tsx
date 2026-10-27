import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { Crest } from "./Crest";
import { GearIcon } from "./icons";
import { SCREENS, type ScreenKey } from "./Titlebar";

const SHORT_LABEL: Record<ScreenKey, string> = {
  dashboard: "Зал",
  questlog: "Доска",
  character: "Герой",
  inventory: "Казна",
  settings: "Устав",
};

const ITEMS = [...SCREENS, { key: "settings", label: "Устав гильдии", Icon: GearIcon }] as const;

/** Навигация на телефоне: те же печати, что в titlebar, внизу под большим пальцем. */
export function BottomNav({ screen, onNavigate }: { screen: ScreenKey; onNavigate: (s: ScreenKey) => void }) {
  return (
    <nav className="relative z-30 grid shrink-0 grid-cols-5 border-t border-gold/25 bg-wood/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-current={screen === key ? "page" : undefined}
          onClick={() => {
            onNavigate(key);
          }}
          className={cn(
            "flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 text-[11px] transition-colors",
            screen === key ? "text-gold-bright" : "text-parchment/55",
          )}
        >
          <Icon className="h-5 w-5" />
          {SHORT_LABEL[key]}
        </button>
      ))}
    </nav>
  );
}

/** Верхняя полоса на телефоне: только где герой сейчас, под вырезом экрана. */
export function MobileHeader({ location }: { location: string }) {
  const { crest } = useGame();
  return (
    <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-gold/25 bg-wood/85 px-4 pb-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] backdrop-blur">
      <Crest choice={crest} className="h-5 w-4" />
      <span className="font-display text-base text-gold-bright">Штаб гильдии</span>
      <span className="text-sm text-parchment/50">· {location}</span>
    </header>
  );
}

import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { Crest } from "./Crest";
import { BoardIcon, ChestIcon, CloseIcon, GearIcon, HallIcon, HelmIcon, MaximizeIcon, MinimizeIcon } from "./icons";
import { Tooltip } from "../ui/tooltip";

export type ScreenKey = "dashboard" | "questlog" | "character" | "inventory" | "settings";

export const SCREENS: ReadonlyArray<{ key: ScreenKey; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { key: "dashboard", label: "Тронный зал", Icon: HallIcon },
  { key: "questlog", label: "Доска квестов", Icon: BoardIcon },
  { key: "character", label: "Герой", Icon: HelmIcon },
  { key: "inventory", label: "Сокровищница", Icon: ChestIcon },
];

function Rivet({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-7 w-9 cursor-pointer place-items-center rounded text-parchment/70 transition-colors hover:text-parchment",
        danger ? "hover:bg-burgundy" : "hover:bg-parchment/10",
      )}
    >
      {children}
    </button>
  );
}

/** Кастомный заголовок окна: герб гильдии, навигация печатями, латунные заклёпки управления. */
export function Titlebar({ location, screen, onNavigate }: { location: string; screen: ScreenKey; onNavigate: (s: ScreenKey) => void }) {
  const win = getCurrentWindow();
  const { crest } = useGame();
  return (
    <header
      data-tauri-drag-region
      className="relative z-30 grid h-9 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gold/25 bg-wood/85 px-2 backdrop-blur"
    >
      <div data-tauri-drag-region className="flex items-center gap-2 text-sm text-parchment/80">
        <Crest choice={crest} className="h-6 w-5" />
        <span data-tauri-drag-region className="font-display text-base text-gold-bright">
          Штаб гильдии
        </span>
        <span data-tauri-drag-region className="text-parchment/65">
          · {location}
        </span>
      </div>
      <nav className="flex items-center gap-1">
        {SCREENS.map(({ key, label, Icon }, i) => (
          <Tooltip key={key} content={`${label} · ${i + 1}`}>
            <button
              type="button"
              aria-label={label}
              aria-current={screen === key ? "page" : undefined}
              onClick={() => {
                onNavigate(key);
              }}
              className={cn(
                "grid h-7 w-10 cursor-pointer place-items-center rounded transition-colors",
                screen === key ? "bg-gold/20 text-gold-bright" : "text-parchment/70 hover:text-parchment",
              )}
            >
              <Icon className="h-4.5 w-4.5" />
            </button>
          </Tooltip>
        ))}
      </nav>
      <div className="flex justify-end">
        <Tooltip content="Устав гильдии">
          <button
            type="button"
            aria-label="Настройки"
            aria-current={screen === "settings" ? "page" : undefined}
            onClick={() => {
              onNavigate(screen === "settings" ? "dashboard" : "settings");
            }}
            className={cn(
              "mr-2 grid h-7 w-9 cursor-pointer place-items-center rounded transition-colors",
              screen === "settings" ? "bg-gold/20 text-gold-bright" : "text-parchment/65 hover:text-parchment",
            )}
          >
            <GearIcon className="h-4 w-4" />
          </button>
        </Tooltip>
        <Rivet label="Свернуть" onClick={() => void win.minimize()}>
          <MinimizeIcon className="h-4 w-4" />
        </Rivet>
        <Rivet label="Развернуть" onClick={() => void win.toggleMaximize()}>
          <MaximizeIcon className="h-3.5 w-3.5" />
        </Rivet>
        <Rivet label="Закрыть" danger onClick={() => void win.close()}>
          <CloseIcon className="h-4 w-4" />
        </Rivet>
      </div>
    </header>
  );
}

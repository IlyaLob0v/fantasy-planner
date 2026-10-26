import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ComponentType, SVGProps } from "react";

import { cn } from "@/lib/utils";

import { BoardIcon, CloseIcon, HallIcon, HelmIcon, MaximizeIcon, MinimizeIcon } from "./icons";
import { Tooltip } from "../ui/tooltip";

export type ScreenKey = "dashboard" | "questlog" | "character";

export const SCREENS: ReadonlyArray<{ key: ScreenKey; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }> = [
  { key: "dashboard", label: "Тронный зал", Icon: HallIcon },
  { key: "questlog", label: "Доска квестов", Icon: BoardIcon },
  { key: "character", label: "Герой", Icon: HelmIcon },
];

function Rivet({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid h-7 w-9 cursor-pointer place-items-center rounded text-parchment/60 transition-colors hover:text-parchment",
        danger ? "hover:bg-burgundy" : "hover:bg-parchment/10",
      )}
    >
      {children}
    </button>
  );
}

/** Кастомный заголовок окна: печать гильдии, навигация печатями, латунные заклёпки управления. */
export function Titlebar({ location, screen, onNavigate }: { location: string; screen: ScreenKey; onNavigate: (s: ScreenKey) => void }) {
  const win = getCurrentWindow();
  return (
    <header
      data-tauri-drag-region
      className="relative z-30 grid h-9 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-gold/25 bg-wood/85 px-2 backdrop-blur"
    >
      <div data-tauri-drag-region className="flex items-center gap-2 text-sm text-parchment/80">
        <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
          <circle cx="10" cy="10" r="9" fill="#6b1e2a" stroke="#c9a24a" strokeWidth="1" />
          <path d="M6 14V8l1.5-1V5h1v1.5L10 5.5l1.5 1V5h1v2L14 8v6Z" fill="#c9a24a" />
        </svg>
        <span data-tauri-drag-region className="font-display text-base text-gold-bright">
          Штаб гильдии
        </span>
        <span data-tauri-drag-region className="text-parchment/50">
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
                screen === key ? "bg-gold/20 text-gold-bright" : "text-parchment/60 hover:text-parchment",
              )}
            >
              <Icon className="h-4.5 w-4.5" />
            </button>
          </Tooltip>
        ))}
      </nav>
      <div className="flex justify-end">
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

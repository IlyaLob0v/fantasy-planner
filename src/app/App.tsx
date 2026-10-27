import { MotionConfig } from "motion/react";
import { useEffect, useState, type CSSProperties } from "react";

import { isMobile } from "@/app/platform";
import { assets, heroPortrait, locationAsset, type AssetKey } from "@/assets/registry";
import { BottomNav, MobileHeader } from "@/components/kit/BottomNav";
import { FindToast } from "@/components/kit/FindToast";
import { GloryToast } from "@/components/kit/GloryToast";
import { LocationVeil } from "@/components/kit/LocationVeil";
import { Oath } from "@/components/kit/Oath";
import { RewardLayer } from "@/components/kit/RewardLayer";
import { SceneBackdrop } from "@/components/kit/SceneBackdrop";
import { SCREENS, Titlebar, type ScreenKey } from "@/components/kit/Titlebar";
import { WeekToast } from "@/components/kit/WeekToast";
import { CharacterScreen } from "@/screens/Character";
import { Dashboard } from "@/screens/Dashboard";
import { Inventory, type InventoryTab } from "@/screens/Inventory";
import { QuestLog } from "@/screens/QuestLog";
import { SettingsScreen } from "@/screens/Settings";
import { GameProvider, useGame, useGameBoot } from "@/services/game";
import { useReminder } from "@/services/reminder";

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

function ErrorNote() {
  const { error, clearError } = useGame();
  if (!error) return null;
  return (
    <button
      type="button"
      onClick={clearError}
      className="fixed bottom-[calc(var(--bottom-chrome)+1.25rem)] left-1/2 z-50 -translate-x-1/2 cursor-pointer rounded-[var(--radius-panel)] border border-burgundy bg-wood/95 px-4 py-2 text-sm text-parchment shadow-xl"
    >
      Летописец сбился: {error}
    </button>
  );
}

function Shell() {
  const { character, settings, perks } = useGame();
  useReminder();
  const [screen, setScreen] = useState<ScreenKey>("dashboard");
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>("shop");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = SCREENS[Number(e.key) - 1];
      if (target) setScreen(target.key);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const location = locationAsset(character.locationKey);
  const backdrop: AssetKey = screen === "character" ? heroPortrait(character.level) : screen === "inventory" ? "treasury" : location;
  const theme = assets[backdrop].theme;
  const vars: CSSProperties & Record<`--${string}`, string> = {
    "--panel-wood": theme.panelWood,
    "--panel-parchment": theme.panelParchment,
    "--scene-tint": theme.tint,
    "--bottom-chrome": isMobile ? "calc(3.5rem + env(safe-area-inset-bottom))" : "0px",
  };

  return (
    <MotionConfig reducedMotion={settings.motion === "reduced" ? "always" : "user"}>
      <div className="relative flex h-full flex-col" style={vars}>
        <SceneBackdrop asset={backdrop} dim={screen === "questlog" ? 0.4 : screen === "settings" ? 0.55 : 0} dusk={character.fatiguedSince !== null && !perks.has("clear_mind")} />
        {isMobile ? (
          <MobileHeader location={assets[location].name} />
        ) : (
          <Titlebar location={assets[location].name} screen={screen} onNavigate={setScreen} />
        )}
        <main className="relative min-h-0 flex-1">
          {screen === "dashboard" && (
            <Dashboard
              onOpenBoard={() => {
                setScreen("questlog");
              }}
            />
          )}
          {screen === "questlog" && <QuestLog />}
          {screen === "character" && <CharacterScreen />}
          {screen === "inventory" && <Inventory tab={inventoryTab} onTab={setInventoryTab} />}
          {screen === "settings" && <SettingsScreen />}
        </main>
        {isMobile && <BottomNav screen={screen} onNavigate={setScreen} />}
        <RewardLayer
          onOpenMap={() => {
            setInventoryTab("map");
            setScreen("inventory");
          }}
        />
        <FindToast />
        <GloryToast />
        <WeekToast />
        <Oath />
        <LocationVeil locationKey={character.locationKey} />
        <ErrorNote />
      </div>
    </MotionConfig>
  );
}

export function App() {
  const boot = useGameBoot();
  if (boot.status === "loading") {
    return (
      <div className="grid h-full place-items-center">
        <p className="font-display text-2xl text-gold-bright/80">Ворота открываются…</p>
      </div>
    );
  }
  if (boot.status === "failed") {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <p className="font-display text-3xl text-gold-bright">Ворота не открылись</p>
          <p className="mt-2 text-parchment/70">{boot.message}</p>
        </div>
      </div>
    );
  }
  return (
    <GameProvider game={boot.game}>
      <Shell />
    </GameProvider>
  );
}

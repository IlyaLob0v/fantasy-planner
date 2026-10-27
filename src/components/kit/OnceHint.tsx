import type { ReactNode } from "react";

import { useGame } from "@/services/game";

/** Короткое пояснение при первой встрече с механикой. Закрыл — больше не появится. */
export function OnceHint({ id, children }: { id: string; children: ReactNode }) {
  const { settings, markHintSeen } = useGame();
  if (settings.hintsSeen.includes(id)) return null;
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-gold/25 bg-ink-deep/45 px-3 py-2 text-xs text-parchment/75">
      <p className="flex-1">{children}</p>
      <button
        type="button"
        className="shrink-0 cursor-pointer text-parchment/50 hover:text-gold-bright"
        onClick={() => {
          markHintSeen(id);
        }}
      >
        Понятно
      </button>
    </div>
  );
}

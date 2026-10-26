import { useEffect, useState } from "react";

import { gameDate } from "@/domain/time";
import type { GameDate } from "@/domain/types";

/** Текущие игровые сутки; обновляется раз в 30 секунд, чтобы поймать смену дня без перезапуска. */
export function useGameDate(dayStartHour: number | null): GameDate | null {
  const [today, setToday] = useState<GameDate | null>(() =>
    dayStartHour === null ? null : gameDate(new Date(), dayStartHour),
  );
  useEffect(() => {
    if (dayStartHour === null) {
      return;
    }
    const tick = () => {
      setToday(gameDate(new Date(), dayStartHour));
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => {
      window.clearInterval(id);
    };
  }, [dayStartHour]);
  return today;
}

import { useEffect, useState } from "react";

import { isEvening } from "@/domain/chronicle";
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

/** Вечер ли сейчас в игровых сутках; пересчитывается раз в минуту. */
export function useEvening(dayStartHour: number): boolean {
  const [evening, setEvening] = useState(() => isEvening(new Date(), dayStartHour));
  useEffect(() => {
    const id = window.setInterval(() => {
      setEvening(isEvening(new Date(), dayStartHour));
    }, 60_000);
    return () => {
      window.clearInterval(id);
    };
  }, [dayStartHour]);
  return evening || isEvening(new Date(), dayStartHour);
}

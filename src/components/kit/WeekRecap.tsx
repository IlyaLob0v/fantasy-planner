import { gloryByKey } from "@/domain/achievements";
import { addDays, humanDate, humanWeekday } from "@/domain/time";
import { useGame } from "@/services/game";

import { Button } from "../ui/button";
import { RARITY_TEXT } from "./Equipment";
import { Panel, PanelTitle } from "./Panel";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl leading-none text-gold-bright tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-parchment/65">{label}</p>
    </div>
  );
}

/** Летопись прошлой недели: одна карточка в первый день новой недели, закрывается одним кликом. */
export function WeekRecap() {
  const { recap, closeRecap } = useGame();
  if (!recap) return null;
  const glory = recap.glory.flatMap((k) => gloryByKey(k) ?? []);

  return (
    <Panel className="p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3">
        <PanelTitle className="text-xl">Летопись недели</PanelTitle>
        <span className="text-sm text-parchment/65">
          {humanDate(recap.weekStart)} — {humanDate(addDays(recap.weekStart, 6))}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat value={String(recap.deeds)} label="дел совершено" />
        <Stat value={`+${String(recap.xp)}`} label="опыта" />
        <Stat value={`+${String(recap.gold)}`} label="золота" />
      </div>
      <ul className="mt-4 flex flex-col gap-1.5 text-sm text-parchment/80">
        {recap.bestDay && (
          <li>
            Лучший день: {humanWeekday(recap.bestDay.date)}, {recap.bestDay.deeds} дел
          </li>
        )}
        {recap.goalsTotal > 0 && (
          <li>
            Цели недели: {recap.goalsDone} из {recap.goalsTotal}
          </li>
        )}
        {recap.finds.length > 0 && (
          <li>
            Находки:{" "}
            {recap.finds.map((f, i) => (
              <span key={f.key} className={RARITY_TEXT[f.rarity]}>
                {i > 0 && ", "}
                {f.name}
              </span>
            ))}
          </li>
        )}
        {glory.length > 0 && <li>Зал славы: {glory.map((d) => d.title).join(", ")}</li>}
      </ul>
      {recap.lines.length > 0 && (
        <div className="mt-3 border-l-2 border-gold/30 pl-3 font-display text-lg italic leading-snug text-parchment/75">
          {recap.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      )}
      <Button variant="outline" size="sm" className="mt-4" onClick={closeRecap}>
        Закрыть летопись
      </Button>
    </Panel>
  );
}

import { BRANCH_TITLE, GLORY_BRANCHES } from "@/domain/achievements";
import { gameDateOfIso, humanDate } from "@/domain/time";
import { useGame } from "@/services/game";

import { GlorySeal } from "./GlorySeal";
import { Panel, PanelTitle } from "./Panel";

/** Зал славы на экране героя: все вехи по веткам, открытые с датой, закрытые с прогрессом. */
export function HallOfFame() {
  const { glory, settings } = useGame();
  const opened = glory.filter((p) => p.unlockedAt !== null).length;

  return (
    <Panel className="p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <PanelTitle className="text-xl">Зал славы</PanelTitle>
        <span className="text-sm text-parchment/70">
          {opened} / {glory.length}
        </span>
      </div>
      <div className="flex flex-col gap-4">
        {GLORY_BRANCHES.map((branch) => (
          <section key={branch}>
            <h3 className="mb-2 text-xs uppercase tracking-wider text-parchment/60">{BRANCH_TITLE[branch]}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {glory
                .filter((p) => p.def.branch === branch)
                .map((p) => {
                  const open = p.unlockedAt !== null;
                  return (
                    <li key={p.def.key} className="flex items-center gap-3">
                      <GlorySeal tier={p.def.tier} open={open} ratio={p.current / p.def.target} />
                      <div className="min-w-0">
                        <p className={open ? "truncate text-sm text-parchment" : "truncate text-sm text-parchment/70"}>{p.def.title}</p>
                        <p className="truncate text-xs text-parchment/60">
                          {p.unlockedAt !== null
                            ? humanDate(gameDateOfIso(p.unlockedAt, settings.dayStartHour))
                            : p.def.target > 1
                              ? `${p.def.description} · ${p.current} / ${p.def.target}`
                              : p.def.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}

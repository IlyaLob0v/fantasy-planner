import { useState } from "react";

import { GOLD_ANCHOR_ID } from "@/app/anchors";
import { RARITY_LABEL } from "@/app/strings";
import { Coin } from "@/components/kit/icons";
import { BuyButton } from "@/components/kit/BuyButton";
import { Hearth } from "@/components/kit/Hearth";
import { RARITY_FRAME } from "@/components/kit/rarity";
import { Panel, PanelTitle } from "@/components/kit/Panel";
import { Chip } from "@/components/kit/pickers";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { trophies } from "@/domain/bosses";
import { isOnSale, restDaysAhead, unusedRewards, usedRewards } from "@/domain/shop";
import { addDays, gameDateOfIso, humanDate, humanWeekday } from "@/domain/time";
import type { RealReward, RealRewardFields } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { WorldMap } from "./WorldMap";

export type InventoryTab = "shop" | "chest" | "map";

const label = "flex flex-col gap-1 text-xs text-parchment/60";
const card = "flex flex-col gap-3 rounded-[var(--radius-panel)] border border-parchment/10 bg-ink-deep/40 p-4";

function RestDayCard() {
  const { character, settings, days, today, buyRest } = useGame();
  const [date, setDate] = useState(() => addDays(today, 1));
  const taken = days.some((d) => d.gameDate === date && d.kind === "rest");
  const past = date < today;

  return (
    <div className={cn(card, "border-gold/25")}>
      <div className="flex items-start gap-3">
        <Hearth lit className="h-10 w-10 shrink-0" />
        <div>
          <p className="font-display text-xl leading-tight text-parchment">День отдыха у камина</p>
          <p className="text-xs text-parchment/55">Серия не прерывается, даже если в этот день не будет ни одного дела.</p>
        </div>
      </div>
      <div className="flex items-end justify-between gap-3">
        <label className={cn(label, "w-44")}>
          Какой день
          <Input
            type="date"
            min={today}
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
          />
        </label>
        <BuyButton
          price={settings.restPrice}
          gold={character.gold}
          disabledReason={past ? "Только вперёд" : taken ? "Уже отдых" : null}
          onBuy={(origin) => {
            buyRest(date, origin);
          }}
        />
      </div>
    </div>
  );
}

function RewardCard({ reward, onEdit }: { reward: RealReward; onEdit: () => void }) {
  const { character, buyReward } = useGame();
  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onEdit} className="min-w-0 cursor-pointer text-left" aria-label={`Изменить: ${reward.title}`}>
          <p className="font-display text-xl leading-tight text-parchment hover:text-gold-bright">{reward.title}</p>
          {reward.description && <p className="mt-0.5 line-clamp-2 text-xs text-parchment/55">{reward.description}</p>}
        </button>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="text-xs text-parchment/45">{reward.repeatable ? "многоразовая" : "разовая"}</span>
        <BuyButton
          price={reward.price}
          gold={character.gold}
          onBuy={(origin) => {
            buyReward(reward, origin);
          }}
        />
      </div>
    </div>
  );
}

function Shop({ onEdit }: { onEdit: (r: RealReward | "new") => void }) {
  const { rewards, inventory } = useGame();
  const onSale = rewards.filter((r) => isOnSale(r, inventory));

  return (
    <div className="flex flex-col gap-3">
      <RestDayCard />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {onSale.map((r) => (
          <RewardCard
            key={r.id}
            reward={r}
            onEdit={() => {
              onEdit(r);
            }}
          />
        ))}
      </div>
      {onSale.length === 0 && (
        <p className="text-sm text-parchment/50">
          Прилавок пуст. Выставь то, чем хочешь себя порадовать: вечер с книгой, поход в кино, новую настолку.
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => {
          onEdit("new");
        }}
      >
        + Награда
      </Button>
    </div>
  );
}

function Chest() {
  const { inventory, days, today, settings, redeem } = useGame();
  const unused = unusedRewards(inventory);
  const used = usedRewards(inventory).slice(0, 20);
  const restDays = restDaysAhead(days, today);
  const loot = trophies(inventory);
  const dateOf = (iso: string) => humanDate(gameDateOfIso(iso, settings.dayStartHour));

  return (
    <div className="flex flex-col gap-5">
      {unused.length === 0 && restDays.length === 0 && loot.length === 0 && (
        <p className="text-sm text-parchment/50">
          {used.length > 0 ? "Всё купленное уже пошло в дело." : "Сундук пока пуст. Всё купленное в лавке ждёт здесь своего часа."}
        </p>
      )}
      {unused.length > 0 && (
        <ul className="flex flex-col gap-2">
          {unused.map((item) => (
            <li key={item.id} className={cn(card, "flex-row items-center justify-between py-3")}>
              <div>
                <p className="text-[15px] text-parchment">{item.itemName}</p>
                <p className="text-xs text-parchment/45">куплено {dateOf(item.obtainedAt)}</p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  redeem(item);
                }}
              >
                Использовать
              </Button>
            </li>
          ))}
        </ul>
      )}
      {loot.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-parchment/40">Трофеи</p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {loot.map((item) => (
              <li key={item.id} className={cn("rounded-[var(--radius-panel)] border-2 bg-ink-deep/40 px-3 py-2", RARITY_FRAME[item.rarity])}>
                <p className="text-[15px] leading-snug text-parchment">{item.itemName}</p>
                <p className="text-xs text-parchment/45">
                  {RARITY_LABEL[item.rarity]} · {dateOf(item.obtainedAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {restDays.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-parchment/40">Дни отдыха впереди</p>
          <ul className="flex flex-wrap gap-2">
            {restDays.map((d) => (
              <li key={d} className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-ink-deep/40 px-3 py-1 text-sm text-parchment/80">
                <Hearth lit className="h-4 w-4" />
                {d === today ? "сегодня" : `${humanWeekday(d)}, ${humanDate(d)}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {used.length > 0 && (
        <div>
          <p className="mb-2 text-xs uppercase tracking-wider text-parchment/40">Уже порадовался</p>
          <ul className="flex flex-col gap-1 text-sm text-parchment/55">
            {used.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="truncate">{item.itemName}</span>
                <span className="shrink-0 text-xs">{item.redeemedAt ? dateOf(item.redeemedAt) : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function blankReward(): RealRewardFields {
  return { title: "", description: null, price: 30, repeatable: true };
}

function RewardEditor({ reward, onDone }: { reward: RealReward | null; onDone: () => void }) {
  const { saveReward, archiveReward, settings } = useGame();
  const [draft, setDraft] = useState<RealRewardFields>(() =>
    reward ? { title: reward.title, description: reward.description, price: reward.price, repeatable: reward.repeatable } : blankReward(),
  );
  const [priceText, setPriceText] = useState(String(draft.price));
  const [saving, setSaving] = useState(false);
  const price = Math.round(Number(priceText));
  const valid = draft.title.trim().length > 0 && Number.isFinite(price) && price >= 1;
  const sideGold = settings.rates.side.gold;

  return (
    <Panel className="flex w-80 shrink-0 flex-col gap-4 self-start p-5">
      <div className="flex items-center justify-between">
        <PanelTitle className="text-xl">{reward ? "Награда" : "Новая награда"}</PanelTitle>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Закрыть
        </Button>
      </div>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          setSaving(true);
          saveReward(reward?.id ?? null, { ...draft, price, title: draft.title.trim(), description: draft.description?.trim() || null })
            .then(onDone)
            .catch(() => {
              setSaving(false);
            });
        }}
      >
        <label className={label}>
          Название
          <Input
            autoFocus
            value={draft.title}
            placeholder="Вечер с книгой у камина"
            onChange={(e) => {
              setDraft((d) => ({ ...d, title: e.target.value }));
            }}
          />
        </label>
        <label className={label}>
          Подробности
          <Textarea
            className="min-h-16"
            value={draft.description ?? ""}
            onChange={(e) => {
              setDraft((d) => ({ ...d, description: e.target.value || null }));
            }}
          />
        </label>
        <label className={cn(label, "w-36")}>
          Цена, зол.
          <Input
            type="number"
            min={1}
            value={priceText}
            onChange={(e) => {
              setPriceText(e.target.value);
            }}
          />
        </label>
        <p className="flex items-center gap-1.5 text-xs text-parchment/45">
          Это примерно {Math.max(1, Math.round((valid ? price : 1) / Math.max(1, sideGold)))} побочных квестов по <Coin className="h-3.5 w-3.5" />
          {sideGold}.
        </p>
        <div className="flex gap-1">
          <Chip
            active={draft.repeatable}
            onClick={() => {
              setDraft((d) => ({ ...d, repeatable: true }));
            }}
          >
            Многоразовая
          </Chip>
          <Chip
            active={!draft.repeatable}
            onClick={() => {
              setDraft((d) => ({ ...d, repeatable: false }));
            }}
          >
            Разовая
          </Chip>
        </div>
        <div className="flex items-center justify-between gap-2">
          {reward ? (
            <Button
              type="button"
              variant="quiet"
              size="sm"
              onClick={() => {
                archiveReward(reward.id);
                onDone();
              }}
            >
              Убрать с прилавка
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={!valid || saving}>
            {reward ? "Сохранить" : "Выставить"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/** Сокровищница: потратить золото и посмотреть, что заработано. */
export function Inventory({ tab, onTab }: { tab: InventoryTab; onTab: (tab: InventoryTab) => void }) {
  const { character, inventory } = useGame();
  const [editing, setEditing] = useState<RealReward | "new" | null>(null);
  const waiting = unusedRewards(inventory).length;

  return (
    <div className="flex h-full items-start gap-5 overflow-y-auto p-6 scrollbar-quiet">
      <Panel className="flex w-full max-w-[620px] flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <PanelTitle>Сокровищница</PanelTitle>
          <span className="flex items-center gap-1.5 font-display text-xl text-gold-bright">
            <Coin id={GOLD_ANCHOR_ID} className="h-5 w-5" />
            {character.gold}
          </span>
        </div>
        <div className="flex gap-1" role="tablist">
          {(
            [
              ["shop", "Лавка"],
              ["chest", waiting > 0 ? `Сундук · ${waiting}` : "Сундук"],
              ["map", "Карта мира"],
            ] satisfies ReadonlyArray<[InventoryTab, string]>
          ).map(([key, title]) => (
            <Chip
              key={key}
              role="tab"
              aria-selected={tab === key}
              active={tab === key}
              className="px-4 text-sm"
              onClick={() => {
                onTab(key);
              }}
            >
              {title}
            </Chip>
          ))}
        </div>
        {tab === "shop" && <Shop onEdit={setEditing} />}
        {tab === "chest" && <Chest />}
        {tab === "map" && <WorldMap />}
      </Panel>
      <div className="flex-1" aria-hidden />
      {editing !== null && (
        <RewardEditor
          key={editing === "new" ? "new" : editing.id}
          reward={editing === "new" ? null : editing}
          onDone={() => {
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

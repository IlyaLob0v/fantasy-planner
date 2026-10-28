import { useRef, useState } from "react";

import { ATTRIBUTE_LABEL, xpText } from "@/app/strings";
import { blankValor, prepareValor, valorFieldsOf, valorProblem, VALOR_DAILY_CAP, type ValorCount } from "@/domain/valors";
import type { Valor, ValorFields } from "@/domain/types";
import { cn } from "@/lib/utils";
import { useGame } from "@/services/game";

import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Tooltip } from "../ui/tooltip";
import { Coin } from "./icons";
import { AttributePicker } from "./pickers";

const label = "flex flex-col gap-1 text-xs text-parchment/60";

function ValorSeal({ item }: { item: ValorCount }) {
  const { markValor, undoValor, settings } = useGame();
  const ref = useRef<HTMLButtonElement>(null);
  const { valor } = item;
  const rate = settings.rates.valor;

  return (
    <li className="flex items-center gap-1">
      <Tooltip content={`${xpText(rate.xp)} · ${String(rate.gold)} зол. · ${ATTRIBUTE_LABEL[valor.attribute]}`}>
        <button
          ref={ref}
          type="button"
          aria-label={`Отметить: ${valor.title}`}
          onClick={() => {
            markValor(valor, ref.current?.getBoundingClientRect() ?? null);
          }}
          className={cn(
            "flex cursor-pointer items-center gap-2.5 rounded-full border py-1 pl-1 pr-3.5 text-left transition-colors",
            item.today > 0 ? "border-gold/50 bg-gold/15" : "border-parchment/15 bg-ink-deep/35 hover:border-gold/40",
          )}
        >
          <span className="grid h-7 min-w-7 shrink-0 place-items-center rounded-full bg-ink-deep/60 px-1 text-sm tabular-nums text-gold/90 ring-1 ring-gold/40">
            {item.today > 0 ? item.today : "+"}
          </span>
          <span className="flex flex-col leading-tight">
            <span className={cn("text-sm", item.today > 0 ? "text-gold-bright" : "text-parchment")}>{valor.title}</span>
            <span className="text-[11px] text-parchment/45">
              {[valor.realName, item.week > 0 ? `за неделю ${String(item.week)}` : null].filter((part) => part !== null).join(" · ")}
            </span>
          </span>
        </button>
      </Tooltip>
      {item.today > 0 && (
        <Tooltip content="Отменить последнюю отметку">
          <button
            type="button"
            aria-label={`Отменить отметку: ${valor.title}`}
            onClick={() => {
              undoValor(valor);
            }}
            className="cursor-pointer px-1 text-sm text-parchment/40 hover:text-parchment"
          >
            ↶
          </button>
        </Tooltip>
      )}
    </li>
  );
}

function ValorForm({ valor, onDone }: { valor: Valor | null; onDone: () => void }) {
  const { saveValor, archiveValor, valors } = useGame();
  const [draft, setDraft] = useState<ValorFields>(() => (valor ? valorFieldsOf(valor) : blankValor(valors.length)));
  const [saving, setSaving] = useState(false);
  const problem = valorProblem(draft);

  const save = () => {
    if (problem) return;
    setSaving(true);
    saveValor(valor?.id ?? null, prepareValor(draft))
      .then(onDone)
      .catch(() => {
        setSaving(false);
      });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className={label}>
        Название
        <Input
          autoFocus
          value={draft.title}
          placeholder="Глоток из родника"
          onChange={(e) => {
            setDraft((d) => ({ ...d, title: e.target.value }));
          }}
        />
      </label>
      <label className={label}>
        В жизни это
        <Input
          value={draft.realName ?? ""}
          placeholder="выпил стакан воды"
          onChange={(e) => {
            setDraft((d) => ({ ...d, realName: e.target.value || null }));
          }}
        />
      </label>
      <div className={label}>
        Атрибут
        <AttributePicker
          value={draft.attribute}
          onChange={(attribute) => {
            setDraft((d) => ({ ...d, attribute }));
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        {valor ? (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => {
              archiveValor(valor.id);
              onDone();
            }}
          >
            Убрать из зала
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Отмена
          </Button>
          <Button type="submit" size="sm" disabled={problem !== null || saving} title={problem ?? undefined}>
            Сохранить
          </Button>
        </div>
      </div>
    </form>
  );
}

function ValorsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { valors, settings } = useGame();
  const [editing, setEditing] = useState<Valor | "new" | null>(null);
  const rate = settings.rates.valor;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setEditing(null);
        onOpenChange(next);
      }}
      title="Доблести"
      description="Малые подвиги без расписания: нажал и отметил."
    >
      {editing !== null ? (
        <ValorForm
          key={editing === "new" ? "new" : editing.id}
          valor={editing === "new" ? null : editing}
          onDone={() => {
            setEditing(null);
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1">
            {valors.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 rounded-md border border-parchment/10 px-3 py-1.5">
                <span className="flex flex-col leading-tight">
                  <span className="text-sm text-parchment">{v.title}</span>
                  <span className="text-[11px] text-parchment/45">{[v.realName, ATTRIBUTE_LABEL[v.attribute]].filter((p) => p !== null).join(" · ")}</span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(v);
                  }}
                >
                  Править
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-parchment/50">
            Награда за отметку: {xpText(rate.xp)}, <Coin className="inline h-3.5 w-3.5 align-[-2px]" /> {rate.gold}. Её приносят первые {VALOR_DAILY_CAP} отметок в
            сутки, дальше растёт только счёт. Доблесть не считается делом дня: серию и усталость она не трогает, находок не даёт.
          </p>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setEditing("new");
              }}
            >
              Новая доблесть
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Доблести под ритуалами: клик отмечает, стрелка отменяет последнюю отметку сегодняшних суток. */
export function ValorRow() {
  const { valorCounts, valors } = useGame();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wider text-parchment/40">Доблести</p>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
          }}
          className="cursor-pointer text-xs text-gold/80 hover:text-gold-bright"
        >
          {valors.length === 0 ? "+ Доблесть" : "Доблести"}
        </button>
      </div>
      {valorCounts.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {valorCounts.map((item) => (
            <ValorSeal key={item.valor.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-parchment/45">Малые подвиги без расписания: глоток воды, страница книги, десять шагов.</p>
      )}
      <ValorsDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

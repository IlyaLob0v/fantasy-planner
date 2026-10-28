import type { ComponentProps } from "react";

import { ATTRIBUTE_HINT, ATTRIBUTE_LABEL, DIFFICULTY_LABEL, QUEST_TYPE_LABEL } from "@/app/strings";
import { ATTRIBUTES, QUEST_TYPES, type Attribute, type Difficulty, type QuestType } from "@/domain/types";
import { cn } from "@/lib/utils";

import { ATTRIBUTE_ICON } from "./icons";
import { Tooltip } from "../ui/tooltip";

const chip = "grid h-8 cursor-pointer place-items-center rounded-[var(--radius-panel)] border px-2.5 text-xs transition-colors";
const on = "border-gold/70 bg-gold/20 text-gold-bright";
const off = "border-parchment/15 text-parchment/70 hover:text-parchment";

/** Кнопка-переключатель в общем стиле выборщиков. */
export function Chip({
  active,
  className,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { active: boolean }) {
  return <button type="button" aria-pressed={active} className={cn(chip, active ? on : off, className)} {...props} />;
}

export function TypePicker({
  value,
  onChange,
  options = QUEST_TYPES,
  disabled = false,
}: {
  value: QuestType;
  onChange: (t: QuestType) => void;
  options?: readonly QuestType[];
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Тип квеста">
      {options.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={value === t}
          disabled={disabled && value !== t}
          className={cn(chip, value === t ? on : off, "disabled:cursor-not-allowed disabled:opacity-40")}
          onClick={() => {
            onChange(t);
          }}
        >
          {QUEST_TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

export function AttributePicker({ value, onChange }: { value: Attribute; onChange: (a: Attribute) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Атрибут">
      {ATTRIBUTES.map((a) => {
        const Icon = ATTRIBUTE_ICON[a];
        return (
          <Tooltip key={a} content={`${ATTRIBUTE_LABEL[a]}: ${ATTRIBUTE_HINT[a]}`}>
            <button
              type="button"
              role="radio"
              aria-checked={value === a}
              aria-label={ATTRIBUTE_LABEL[a]}
              className={cn(chip, "w-8 px-0", value === a ? on : off)}
              onClick={() => {
                onChange(a);
              }}
            >
              <Icon className="h-4 w-4" />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3];

export function DifficultyPicker({ value, onChange }: { value: Difficulty; onChange: (d: Difficulty) => void }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Сложность">
      {DIFFICULTIES.map((d) => (
        <Tooltip key={d} content={`${DIFFICULTY_LABEL[d]}: награда ×${d}`}>
          <button
            type="button"
            role="radio"
            aria-checked={value === d}
            aria-label={DIFFICULTY_LABEL[d]}
            className={cn(chip, "px-2 font-display text-sm", value === d ? on : off)}
            onClick={() => {
              onChange(d);
            }}
          >
            {"✦".repeat(d)}
          </button>
        </Tooltip>
      ))}
    </div>
  );
}

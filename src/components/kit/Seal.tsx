import type { ComponentProps } from "react";

import type { QuestType } from "@/domain/types";
import { cn } from "@/lib/utils";

import { CheckIcon } from "./icons";

const WAX: Record<QuestType, string> = {
  main: "from-[#8a2a38] to-[#561520] ring-[#a8434f]/50",
  side: "from-[#2c4e74] to-[#17293f] ring-[#4b729c]/50",
};

/** Сургучная печать: кнопка выполнения квеста. Сломанная печать = выполнено. */
export function Seal({
  questType,
  done,
  className,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { questType: QuestType; done: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "group relative grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full bg-gradient-to-br ring-2 transition-transform hover:scale-105 active:scale-95",
        WAX[questType],
        done && "opacity-70 saturate-50",
        className,
      )}
      {...props}
    >
      <span className="absolute inset-1 rounded-full border border-white/15" />
      <CheckIcon
        className={cn(
          "h-5 w-5 text-parchment transition-opacity",
          done ? "opacity-100" : "opacity-0 group-hover:opacity-60",
        )}
      />
    </button>
  );
}

import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const field =
  "w-full rounded-[var(--radius-panel)] border border-gold/30 bg-ink-deep/50 px-3 text-parchment placeholder:text-parchment/60 focus:border-gold/70 focus:outline-none";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, "h-9", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(field, "min-h-24 resize-none py-2", className)} {...props} />;
}

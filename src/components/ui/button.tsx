import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-panel)] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        gold: "bg-gold text-wood hover:bg-gold-bright shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)]",
        ghost: "text-parchment/80 hover:bg-parchment/10 hover:text-parchment",
        outline: "border border-gold/50 text-gold-bright hover:bg-gold/10",
        quiet: "text-parchment/60 hover:text-parchment underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "gold", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

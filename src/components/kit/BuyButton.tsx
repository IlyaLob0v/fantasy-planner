import { useEffect, useRef, useState } from "react";

import { Coin } from "./icons";
import { Button } from "../ui/button";

const ARM_MS = 3000;

/**
 * Покупка без модального окна: первое нажатие взводит кнопку, второе в течение 3 с покупает.
 * Если золота мало, кнопка спокойно говорит, сколько ещё нужно.
 */
export function BuyButton({
  price,
  gold,
  disabledReason = null,
  onBuy,
}: {
  price: number;
  gold: number;
  disabledReason?: string | null;
  onBuy: (origin: DOMRect | null) => void;
}) {
  const [armed, setArmed] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const short = price - gold;

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => {
      setArmed(false);
    }, ARM_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [armed]);

  if (disabledReason !== null || short > 0) {
    return (
      <Button size="sm" variant="outline" disabled className="tabular-nums">
        {disabledReason ?? `Ещё ${short} зол.`}
      </Button>
    );
  }

  return (
    <Button
      ref={ref}
      size="sm"
      variant={armed ? "gold" : "outline"}
      className="tabular-nums"
      onClick={() => {
        if (armed) {
          setArmed(false);
          onBuy(ref.current?.getBoundingClientRect() ?? null);
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? (
        "Точно? Купить"
      ) : (
        <>
          <Coin className="h-4 w-4" />
          {price}
        </>
      )}
    </Button>
  );
}

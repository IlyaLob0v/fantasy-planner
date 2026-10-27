import { describe, expect, it } from "vitest";

import { character } from "./fixtures.test-helpers";
import { newSagaChapters, nextChapterIn, SAGA, sagaContext, sagaEarned } from "./saga";

describe("Сказ о герое", () => {
  it("24 главы со стабильными ключами", () => {
    expect(SAGA).toHaveLength(24);
    expect(new Set(SAGA.map((c) => c.key)).size).toBe(24);
    expect(SAGA[0]?.key).toBe("saga_01");
  });

  it("глава каждые 5 дней в походе, не больше, чем есть", () => {
    expect(sagaEarned(4, 5)).toBe(0);
    expect(sagaEarned(5, 5)).toBe(1);
    expect(sagaEarned(1000, 5)).toBe(24);
    expect(nextChapterIn(7, 5)).toBe(3);
    expect(nextChapterIn(120, 5)).toBeNull();
  });

  it("новые главы по порядку, уже открытые не повторяются", () => {
    expect(newSagaChapters(15, 5, ["saga_01"]).map((c) => c.key)).toEqual(["saga_02", "saga_03"]);
  });

  it("подстановки: имя, дар по атрибуту, штаб и босс", () => {
    const c = sagaContext(character({ name: "Ирис", strength: 1, intellect: 9, agility: 2 }), "Сосновый бор", "Переезд");
    expect(c.gift).toBe("ясный ум");
    const text = SAGA.flatMap((ch) => ch.text(c)).join(" ");
    expect(text).toContain("Ирис");
    expect(text).toContain("Сосновый бор");
    expect(text).toContain("«Переезд»");
    expect(text).not.toContain("undefined");
    expect(sagaContext(character(), "Башня", null).gift).toBe("упрямое сердце");
  });
});

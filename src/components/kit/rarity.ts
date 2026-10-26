import type { Rarity } from "@/domain/types";

/** Рамка трофея по редкости: от простой до золотого свечения. */
export const RARITY_FRAME: Record<Rarity, string> = {
  common: "border-parchment/30",
  rare: "border-[#4b729c] shadow-[0_0_24px_rgb(75_114_156/0.45)]",
  epic: "border-[#a8434f] shadow-[0_0_28px_rgb(168_67_79/0.5)]",
  legendary: "border-gold-bright shadow-[0_0_36px_rgb(230_195_106/0.6)]",
};

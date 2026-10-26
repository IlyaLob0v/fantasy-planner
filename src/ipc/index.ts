import { invoke } from "@tauri-apps/api/core";

import { isRecord } from "@/domain/guards";
import type {
  Character,
  Day,
  InventoryItem,
  LedgerEntry,
  Outcome,
  Quest,
  QuestFields,
  RealReward,
  RealRewardFields,
  RestAction,
  Ritual,
  RitualCompletion,
  RitualFields,
} from "@/domain/types";

/** Типизированные обёртки над Rust-командами, один к одному с src-tauri/src/commands. */
export const ipc = {
  getCharacter: () => invoke<Character>("get_character"),
  renameCharacter: (name: string) => invoke<Character>("rename_character", { name }),
  getSettings: () => invoke<Record<string, unknown>>("get_settings"),
  listQuests: () => invoke<Quest[]>("list_quests"),
  createQuest: (fields: QuestFields) => invoke<Quest>("create_quest", { fields }),
  updateQuest: (id: number, fields: QuestFields) => invoke<Quest>("update_quest", { id, fields }),
  archiveQuest: (id: number) => invoke<null>("archive_quest", { id }),
  listDays: (since: string) => invoke<Day[]>("list_days", { since }),
  listLedgerForDate: (gameDate: string) => invoke<LedgerEntry[]>("list_ledger_for_date", { gameDate }),
  listRestActions: () => invoke<RestAction[]>("list_rest_actions"),
  createRestAction: (title: string) => invoke<RestAction>("create_rest_action", { title }),
  archiveRestAction: (id: number) => invoke<null>("archive_rest_action", { id }),
  listRituals: () => invoke<Ritual[]>("list_rituals"),
  createRitual: (fields: RitualFields) => invoke<Ritual>("create_ritual", { fields }),
  updateRitual: (id: number, fields: RitualFields) => invoke<Ritual>("update_ritual", { id, fields }),
  archiveRitual: (id: number) => invoke<null>("archive_ritual", { id }),
  listRitualCompletions: (since: string) => invoke<RitualCompletion[]>("list_ritual_completions", { since }),
  listRewards: () => invoke<RealReward[]>("list_rewards"),
  createReward: (fields: RealRewardFields) => invoke<RealReward>("create_reward", { fields }),
  updateReward: (id: number, fields: RealRewardFields) => invoke<RealReward>("update_reward", { id, fields }),
  archiveReward: (id: number) => invoke<null>("archive_reward", { id }),
  listInventory: () => invoke<InventoryItem[]>("list_inventory"),
  redeemItem: (id: number) => invoke<null>("redeem_item", { id }),
  setSetting: (key: "day_start_hour" | "rates" | "rest_price" | "motion", value: unknown) => invoke<null>("set_setting", { key, value }),
  commitOutcome: (outcome: Outcome) => invoke<Character>("commit_outcome", { outcome }),
};

/** Человеческое сообщение из ошибки IPC (AppError сериализуется как { kind, message }). */
export function describeError(error: unknown): string {
  if (isRecord(error) && typeof error["message"] === "string") {
    return error["message"];
  }
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === "string" ? error : "Что-то пошло не так";
}

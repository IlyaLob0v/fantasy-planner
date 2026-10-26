import { invoke } from "@tauri-apps/api/core";

import { isRecord } from "@/domain/guards";
import type { Character, Day, LedgerEntry, Outcome, Quest, QuestFields, RestAction } from "@/domain/types";

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

import { invoke } from "@tauri-apps/api/core";

import { isRecord } from "@/domain/guards";
import type {
  Achievement,
  Character,
  ChronicleEntry,
  CrestPart,
  Day,
  EquipmentSlot,
  Gear,
  GearSlot,
  InnStay,
  InventoryItem,
  LedgerEntry,
  LedgerTally,
  Location,
  NewSagaChapter,
  NewWeekGoal,
  Outcome,
  Quest,
  QuestFields,
  RealReward,
  RealRewardFields,
  RestAction,
  Ritual,
  RitualCompletion,
  RitualFields,
  SyncKeep,
  SyncReport,
  SyncSignIn,
  SyncStatus,
  SagaProgress,
  WeekGoal,
  WeekGoalState,
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
  listLedgerSince: (since: string) => invoke<LedgerEntry[]>("list_ledger_since", { since }),
  ledgerTally: () => invoke<LedgerTally[]>("ledger_tally"),
  listAchievements: () => invoke<Achievement[]>("list_achievements"),
  listGear: () => invoke<Gear[]>("list_gear"),
  listEquipment: () => invoke<EquipmentSlot[]>("list_equipment"),
  setEquipment: (slot: GearSlot, gearId: number | null) => invoke<EquipmentSlot[]>("set_equipment", { slot, gearId }),
  listWeekGoals: (since: string) => invoke<WeekGoal[]>("list_week_goals", { since }),
  createWeekGoals: (goals: NewWeekGoal[]) => invoke<WeekGoal[]>("create_week_goals", { goals }),
  updateWeekGoal: (id: number, goalKey: string, target: number, state: Exclude<WeekGoalState, "done">) =>
    invoke<WeekGoal>("update_week_goal", { id, goalKey, target, state }),
  listCrestParts: () => invoke<CrestPart[]>("list_crest_parts"),
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
  setSetting: (
    key: "day_start_hour" | "rates" | "rest_price" | "motion" | "oath_done" | "hints_seen" | "loot" | "forge_prices" | "week" | "recap_seen" | "crest" | "crest_price" | "starter_pack" | "journey" | "return_seen" | "reminder" | "saga_every_days",
    value: unknown,
  ) => invoke<null>("set_setting", { key, value }),
  commitOutcome: (outcome: Outcome) => invoke<Character>("commit_outcome", { outcome }),
  listChronicle: () => invoke<ChronicleEntry[]>("list_chronicle"),
  saveChronicle: (entry: ChronicleEntry) => invoke<ChronicleEntry>("save_chronicle", { entry }),
  listLocations: () => invoke<Location[]>("list_locations"),
  setHome: (key: string) => invoke<Character>("set_home", { key }),
  syncStatus: () => invoke<SyncStatus>("sync_status"),
  syncSignIn: (form: { server: string; email: string; password: string; deviceName: string; create: boolean }) =>
    invoke<SyncSignIn>("sync_sign_in", form),
  syncLink: (keep: SyncKeep) => invoke<SyncReport>("sync_link", { keep }),
  syncNow: () => invoke<SyncReport>("sync_now"),
  syncSignOut: () => invoke<null>("sync_sign_out"),
  listSagaChapters: () => invoke<SagaProgress[]>("list_saga_chapters"),
  unlockSagaChapters: (chapters: NewSagaChapter[]) => invoke<SagaProgress[]>("unlock_saga_chapters", { chapters }),
  readSagaChapter: (key: string) => invoke<SagaProgress[]>("read_saga_chapter", { key }),
  listInnStays: () => invoke<InnStay[]>("list_inn_stays"),
  /** Новая дата конца комнаты или null: отменить комнату, которая ещё не началась. */
  endInnStay: (id: number, endDate: string | null) => invoke<InnStay[]>("end_inn_stay", { id, endDate }),
};

/** Ошибка IPC с этим видом: `AppError` из src-tauri/src/error.rs. */
export function isErrorKind(error: unknown, kind: string): boolean {
  return isRecord(error) && error["kind"] === kind;
}

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

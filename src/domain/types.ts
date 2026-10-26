export const ATTRIBUTES = ["strength", "intellect", "agility"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

/** Обычные квесты на день. */
export const QUEST_TYPES = ["main", "side"] as const;
/** Всё, что можно завести на доске: квесты и боссы. Этапы создаются внутри босса. */
export const BOARD_TYPES = ["main", "side", "boss"] as const;
export type QuestType = (typeof BOARD_TYPES)[number] | "stage";

export type Difficulty = 1 | 2 | 3;

/** Дата игровых суток в формате YYYY-MM-DD. */
export type GameDate = string;

export interface Character {
  name: string;
  title: string | null;
  level: number;
  xp: number;
  gold: number;
  strength: number;
  intellect: number;
  agility: number;
  streakCurrent: number;
  streakBest: number;
  windStep: number;
  fatiguedSince: GameDate | null;
  /** Дела подряд без находки: защита от невезения. */
  lootMisses: number;
  locationKey: string;
  createdAt: string;
  updatedAt: string;
}

/** Изменяемая часть персонажа: её TS считает, Rust сохраняет. */
export interface CharacterState {
  title: string | null;
  level: number;
  xp: number;
  gold: number;
  strength: number;
  intellect: number;
  agility: number;
  streakCurrent: number;
  streakBest: number;
  windStep: number;
  fatiguedSince: GameDate | null;
  lootMisses: number;
}

export type QuestStatus = "active" | "done";

export interface QuestStatusChange {
  id: number;
  status: QuestStatus;
  completedAt: string | null;
}

export interface Quest {
  id: number;
  parentId: number | null;
  type: QuestType;
  title: string;
  description: string | null;
  attribute: Attribute;
  difficulty: Difficulty;
  status: QuestStatus;
  scheduledDate: GameDate | null;
  dueDate: GameDate | null;
  damage: number;
  sortOrder: number;
  createdAt: string;
  completedAt: string | null;
  archivedAt: string | null;
}

export interface QuestFields {
  type: QuestType;
  title: string;
  description: string | null;
  attribute: Attribute;
  difficulty: Difficulty;
  scheduledDate: GameDate | null;
  dueDate: GameDate | null;
  sortOrder: number;
  /** Только у этапа: id босса. */
  parentId: number | null;
  /** Урон этапа по боссу, 1–10. У остальных квестов 1. */
  damage: number;
}

export type DayKind = "normal" | "rest";

export interface Day {
  gameDate: GameDate;
  kind: DayKind;
  deedsCount: number;
  closedAt: string | null;
}

export type LedgerSource = "quest" | "boss_defeat" | "ritual" | "rest_action" | "purchase" | "rest" | "revert" | "achievement";

export interface LedgerEntry {
  id: number;
  occurredAt: string;
  gameDate: GameDate;
  sourceType: LedgerSource;
  sourceId: number | null;
  xpDelta: number;
  goldDelta: number;
  attribute: Attribute | null;
  attributeDelta: number;
  revertsId: number | null;
  note: string | null;
}

export type NewLedgerEntry = Omit<LedgerEntry, "id" | "occurredAt">;

export interface RestAction {
  id: number;
  title: string;
}

export interface Outcome {
  quests: QuestStatusChange[];
  ritual: { ritualId: number; gameDate: GameDate; done: boolean } | null;
  inventory: NewInventoryItem[];
  /** Лут, который забирается при отмене победы над боссом. */
  removeInventory: number[];
  ledger: NewLedgerEntry[];
  days: Day[];
  character: CharacterState;
  /** Новые достижения; их золото уже лежит в `ledger`. */
  achievements: NewAchievement[];
  /** Новые предметы снаряжения. */
  gear: NewGear[];
  /** Находки, которые забирает отмена дела. */
  removeGear: number[];
}

export const GEAR_SLOTS = ["weapon", "helm", "armor", "cloak", "talisman"] as const;
export type GearSlot = (typeof GEAR_SLOTS)[number];
export type GearSource = "quest" | "ritual" | "boss" | "achievement" | "forge" | "week_chest";

export interface Gear {
  id: number;
  itemKey: string;
  sourceType: GearSource;
  sourceId: number | null;
  gameDate: GameDate;
  missesBefore: number;
  obtainedAt: string;
}

export type NewGear = Omit<Gear, "id" | "obtainedAt"> & { uid: string };

export interface EquipmentSlot {
  slot: GearSlot;
  gearId: number | null;
}

export interface NewAchievement {
  key: string;
  uid: string;
}

export interface Achievement {
  key: string;
  unlockedAt: string;
}

/** Сколько записей журнала источника в силе: без отменённых. */
export interface LedgerTally {
  sourceType: LedgerSource;
  sourceId: number | null;
  count: number;
}

export interface Rate {
  xp: number;
  gold: number;
}

export interface Settings {
  dayStartHour: number;
  rates: { side: Rate; main: Rate; stage: Rate; bossDefeat: Rate; ritual: Rate; restAction: Rate };
  restPrice: number;
  streakBonus: { stepDays: number; stepPct: number; maxPct: number };
  levelCurve: { base: number; exp: number; round: number };
  motion: "full" | "reduced";
  /** Присяга гильдии пройдена или пропущена. */
  oathDone: boolean;
  /** Подсказки, которые уже показаны и больше не появятся. */
  hintsSeen: string[];
  loot: {
    basePct: number;
    stepPct: number;
    pity: number;
    dailyCap: number;
    weights: Record<Rarity, number>;
    unlockLevel: Record<Rarity, number>;
  };
  forgePrices: { common: number; rare: number };
}

export interface Reward {
  xp: number;
  gold: number;
  attribute: Attribute | null;
  attributeDelta: number;
}

export const RITUAL_SCHEDULES = ["daily", "weekdays", "times_per_week", "every_n_days"] as const;
export type RitualSchedule = (typeof RITUAL_SCHEDULES)[number];

export interface RitualFields {
  title: string;
  realName: string | null;
  attribute: Attribute;
  schedule: RitualSchedule;
  /** Бит 0 = понедельник. Только для weekdays. */
  weekdaysMask: number | null;
  timesPerWeek: number | null;
  intervalDays: number | null;
  startDate: GameDate;
  pausedUntil: GameDate | null;
  difficulty: Difficulty;
  sortOrder: number;
}

export interface Ritual extends RitualFields {
  id: number;
  createdAt: string;
  archivedAt: string | null;
}

export interface RitualCompletion {
  ritualId: number;
  gameDate: GameDate;
  completedAt: string;
}

/** Реальная награда из лавки, которую настраивает игрок. */
export interface RealRewardFields {
  title: string;
  description: string | null;
  price: number;
  repeatable: boolean;
}

export interface RealReward extends RealRewardFields {
  id: number;
  createdAt: string;
  archivedAt: string | null;
}

export type InventoryType = "loot" | "reward" | "location";

export interface InventoryItem {
  id: number;
  itemType: InventoryType;
  itemName: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  assetKey: string | null;
  sourceType: "boss" | "purchase" | "level" | null;
  sourceId: number | null;
  obtainedAt: string;
  redeemedAt: string | null;
}

export type Rarity = InventoryItem["rarity"];

export interface NewInventoryItem {
  itemType: InventoryType;
  itemName: string;
  rarity: Rarity;
  assetKey: string | null;
  sourceType: InventoryItem["sourceType"];
  sourceId: number | null;
}

/** Запись хроники за игровые сутки. */
export interface ChronicleEntry {
  gameDate: GameDate;
  happened: string;
  noticed: string;
  feeling: string;
  mood: number | null;
  updatedAt: string;
}

export interface Location {
  key: string;
  name: string;
  assetKey: string;
  unlockLevel: number;
  price: number;
  sortOrder: number;
}

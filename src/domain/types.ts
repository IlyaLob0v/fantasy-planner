export const ATTRIBUTES = ["strength", "intellect", "agility"] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const QUEST_TYPES = ["main", "side"] as const;
export type QuestType = (typeof QUEST_TYPES)[number];

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
}

export type QuestStatus = "active" | "done";

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
}

export type DayKind = "normal" | "rest";

export interface Day {
  gameDate: GameDate;
  kind: DayKind;
  deedsCount: number;
  closedAt: string | null;
}

export type LedgerSource = "quest" | "ritual" | "rest_action" | "purchase" | "rest" | "revert";

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
  quest: { id: number; status: QuestStatus; completedAt: string | null } | null;
  ritual: { ritualId: number; gameDate: GameDate; done: boolean } | null;
  inventory: NewInventoryItem[];
  ledger: NewLedgerEntry[];
  days: Day[];
  character: CharacterState;
}

export interface Rate {
  xp: number;
  gold: number;
}

export interface Settings {
  dayStartHour: number;
  rates: { side: Rate; main: Rate; ritual: Rate; restAction: Rate };
  restPrice: number;
  streakBonus: { stepDays: number; stepPct: number; maxPct: number };
  levelCurve: { base: number; exp: number; round: number };
  motion: "full" | "reduced";
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

export interface NewInventoryItem {
  itemType: InventoryType;
  itemName: string;
  sourceType: InventoryItem["sourceType"];
  sourceId: number | null;
}

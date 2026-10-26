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

export type LedgerSource = "quest" | "rest_action" | "revert";

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
  rates: { side: Rate; main: Rate; restAction: Rate };
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

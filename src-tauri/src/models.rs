use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Character {
    pub name: String,
    pub title: Option<String>,
    pub level: i64,
    pub xp: i64,
    pub gold: i64,
    pub strength: i64,
    pub intellect: i64,
    pub agility: i64,
    pub streak_current: i64,
    pub streak_best: i64,
    pub wind_step: i64,
    pub fatigued_since: Option<String>,
    pub loot_misses: i64,
    pub location_key: String,
    pub created_at: String,
    pub updated_at: String,
}

/// Состояние персонажа после хода, посчитанное в TS. Rust только сохраняет его.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CharacterState {
    pub title: Option<String>,
    pub level: i64,
    pub xp: i64,
    pub gold: i64,
    pub strength: i64,
    pub intellect: i64,
    pub agility: i64,
    pub streak_current: i64,
    pub streak_best: i64,
    pub wind_step: i64,
    pub fatigued_since: Option<String>,
    pub loot_misses: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Quest {
    pub id: i64,
    pub parent_id: Option<i64>,
    #[serde(rename = "type")]
    #[sqlx(rename = "type")]
    pub kind: String,
    pub title: String,
    pub description: Option<String>,
    pub attribute: String,
    pub difficulty: i64,
    pub status: String,
    pub scheduled_date: Option<String>,
    pub due_date: Option<String>,
    pub damage: i64,
    pub sort_order: i64,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub archived_at: Option<String>,
}

/// Редактируемые поля квеста. Передаются целиком: так нет неоднозначности «не менять» и «очистить».
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestFields {
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    pub description: Option<String>,
    pub attribute: String,
    pub difficulty: i64,
    pub scheduled_date: Option<String>,
    pub due_date: Option<String>,
    pub sort_order: i64,
    /// Только для этапа босса.
    #[serde(default)]
    pub parent_id: Option<i64>,
    #[serde(default = "one")]
    pub damage: i64,
}

fn one() -> i64 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Day {
    pub game_date: String,
    pub kind: String,
    pub deeds_count: i64,
    pub closed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LedgerEntry {
    pub id: i64,
    pub occurred_at: String,
    pub game_date: String,
    pub source_type: String,
    pub source_id: Option<i64>,
    pub xp_delta: i64,
    pub gold_delta: i64,
    pub attribute: Option<String>,
    pub attribute_delta: i64,
    pub reverts_id: Option<i64>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewLedgerEntry {
    pub game_date: String,
    pub source_type: String,
    pub source_id: Option<i64>,
    pub xp_delta: i64,
    pub gold_delta: i64,
    pub attribute: Option<String>,
    pub attribute_delta: i64,
    pub reverts_id: Option<i64>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RestAction {
    pub id: i64,
    pub title: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestStatusChange {
    pub id: i64,
    pub status: String,
    pub completed_at: Option<String>,
}

/// Итог одного хода: всё, что нужно записать атомарно.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Outcome {
    #[serde(default)]
    pub quests: Vec<QuestStatusChange>,
    /// Отметки ритуалов: обычно одна, у «Вчера ты успел…» несколько за вчерашние сутки.
    #[serde(default)]
    pub rituals: Vec<RitualMark>,
    #[serde(default)]
    pub inventory: Vec<NewInventoryItem>,
    /// Лут, который забирается обратно при отмене победы над боссом.
    #[serde(default)]
    pub remove_inventory: Vec<i64>,
    pub ledger: Vec<NewLedgerEntry>,
    pub days: Vec<Day>,
    pub character: CharacterState,
    /// Новые достижения; их золото уже лежит в `ledger`.
    #[serde(default)]
    pub achievements: Vec<NewAchievement>,
    /// Новые предметы снаряжения: находки, трофеи, реликвии, покупки у кузнеца.
    #[serde(default)]
    pub gear: Vec<NewGear>,
    /// Находки, которые забирает отмена дела.
    #[serde(default)]
    pub remove_gear: Vec<i64>,
    /// Цели недели, выполненные этим ходом; их золото уже лежит в `ledger`.
    #[serde(default)]
    pub week_goals_done: Vec<i64>,
    /// Купленные части герба.
    #[serde(default)]
    pub crest_parts: Vec<NewCrestPart>,
    /// Новая комната в таверне.
    #[serde(default)]
    pub inn_stays: Vec<NewInnStay>,
}

/// Комната в таверне: сутки с `start_date` по `end_date` включительно нейтральны для серии.
#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct InnStay {
    pub id: i64,
    pub start_date: String,
    pub end_date: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewInnStay {
    pub uid: String,
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewGear {
    pub uid: String,
    pub item_key: String,
    pub source_type: String,
    pub source_id: Option<i64>,
    pub game_date: String,
    pub misses_before: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Gear {
    pub id: i64,
    pub item_key: String,
    pub source_type: String,
    pub source_id: Option<i64>,
    pub game_date: String,
    pub misses_before: i64,
    pub obtained_at: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct EquipmentSlot {
    pub slot: String,
    pub gear_id: Option<i64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewAchievement {
    pub key: String,
    pub uid: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Achievement {
    pub key: String,
    pub unlocked_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewSagaChapter {
    pub key: String,
    pub uid: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SagaChapter {
    pub key: String,
    pub unlocked_at: String,
    pub read_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewWeekGoal {
    pub uid: String,
    pub week_start: String,
    pub goal_key: String,
    pub target: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct WeekGoal {
    pub id: i64,
    pub week_start: String,
    pub goal_key: String,
    pub target: i64,
    pub state: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewCrestPart {
    pub key: String,
    pub uid: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CrestPart {
    pub key: String,
    pub bought_at: String,
}

/// Сколько записей журнала каждого источника осталось в силе (без отменённых).
#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LedgerTally {
    pub source_type: String,
    pub source_id: Option<i64>,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Ritual {
    pub id: i64,
    pub title: String,
    pub real_name: Option<String>,
    pub attribute: String,
    pub schedule: String,
    pub weekdays_mask: Option<i64>,
    pub times_per_week: Option<i64>,
    pub interval_days: Option<i64>,
    pub start_date: String,
    pub paused_until: Option<String>,
    pub difficulty: i64,
    pub sort_order: i64,
    pub created_at: String,
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RitualFields {
    pub title: String,
    pub real_name: Option<String>,
    pub attribute: String,
    pub schedule: String,
    pub weekdays_mask: Option<i64>,
    pub times_per_week: Option<i64>,
    pub interval_days: Option<i64>,
    pub start_date: String,
    pub paused_until: Option<String>,
    pub difficulty: i64,
    pub sort_order: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct RitualCompletion {
    pub ritual_id: i64,
    pub game_date: String,
    pub completed_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RitualMark {
    pub ritual_id: i64,
    pub game_date: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Reward {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub price: i64,
    pub repeatable: bool,
    pub created_at: String,
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RewardFields {
    pub title: String,
    pub description: Option<String>,
    pub price: i64,
    pub repeatable: bool,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct InventoryItem {
    pub id: i64,
    pub item_type: String,
    pub item_name: String,
    pub rarity: String,
    pub asset_key: Option<String>,
    pub source_type: Option<String>,
    pub source_id: Option<i64>,
    pub obtained_at: String,
    pub redeemed_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewInventoryItem {
    pub item_type: String,
    pub item_name: String,
    #[serde(default = "common")]
    pub rarity: String,
    #[serde(default)]
    pub asset_key: Option<String>,
    pub source_type: Option<String>,
    pub source_id: Option<i64>,
}

fn common() -> String {
    "common".into()
}

/// Запись хроники за игровые сутки.
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ChronicleEntry {
    pub game_date: String,
    pub happened: String,
    pub noticed: String,
    pub feeling: String,
    pub mood: Option<i64>,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Location {
    pub key: String,
    pub name: String,
    pub asset_key: String,
    pub unlock_level: i64,
    pub price: i64,
    pub sort_order: i64,
}

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
    pub quest: Option<QuestStatusChange>,
    pub ledger: Vec<NewLedgerEntry>,
    pub days: Vec<Day>,
    pub character: CharacterState,
}

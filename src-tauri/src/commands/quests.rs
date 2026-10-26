use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{Quest, QuestFields};

macro_rules! select_quests {
    ($tail:literal) => {
        concat!(
            "SELECT id, parent_id, type, title, description, attribute, difficulty, status, ",
            "scheduled_date, due_date, damage, sort_order, created_at, completed_at, archived_at ",
            "FROM quests ",
            $tail
        )
    };
}

async fn fetch(pool: &SqlitePool, id: i64) -> AppResult<Quest> {
    sqlx::query_as::<_, Quest>(select_quests!("WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("квест {id}")))
}

fn validate(fields: &QuestFields) -> AppResult<()> {
    if !matches!(fields.kind.as_str(), "main" | "side") {
        return Err(AppError::Invalid(format!("тип квеста {}", fields.kind)));
    }
    if fields.title.trim().is_empty() {
        return Err(AppError::Invalid("у квеста должно быть название".into()));
    }
    Ok(())
}

pub async fn list(pool: &SqlitePool) -> AppResult<Vec<Quest>> {
    Ok(sqlx::query_as::<_, Quest>(select_quests!("WHERE archived_at IS NULL ORDER BY sort_order, id"))
    .fetch_all(pool)
    .await?)
}

pub async fn create(pool: &SqlitePool, fields: QuestFields) -> AppResult<Quest> {
    validate(&fields)?;
    let id = sqlx::query(
        "INSERT INTO quests (type, title, description, attribute, difficulty, scheduled_date, due_date, sort_order) \
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&fields.kind)
    .bind(fields.title.trim())
    .bind(&fields.description)
    .bind(&fields.attribute)
    .bind(fields.difficulty)
    .bind(&fields.scheduled_date)
    .bind(&fields.due_date)
    .bind(fields.sort_order)
    .execute(pool)
    .await?
    .last_insert_rowid();
    fetch(pool, id).await
}

#[tauri::command]
pub async fn list_quests(db: State<'_, Db>) -> AppResult<Vec<Quest>> {
    list(&db.0).await
}

#[tauri::command]
pub async fn create_quest(db: State<'_, Db>, fields: QuestFields) -> AppResult<Quest> {
    create(&db.0, fields).await
}

#[tauri::command]
pub async fn update_quest(db: State<'_, Db>, id: i64, fields: QuestFields) -> AppResult<Quest> {
    validate(&fields)?;
    let affected = sqlx::query(
        "UPDATE quests SET type = ?, title = ?, description = ?, attribute = ?, difficulty = ?, \
         scheduled_date = ?, due_date = ?, sort_order = ? WHERE id = ? AND archived_at IS NULL",
    )
    .bind(&fields.kind)
    .bind(fields.title.trim())
    .bind(&fields.description)
    .bind(&fields.attribute)
    .bind(fields.difficulty)
    .bind(&fields.scheduled_date)
    .bind(&fields.due_date)
    .bind(fields.sort_order)
    .bind(id)
    .execute(&db.0)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::NotFound(format!("квест {id}")));
    }
    fetch(&db.0, id).await
}

#[tauri::command]
pub async fn archive_quest(db: State<'_, Db>, id: i64) -> AppResult<()> {
    sqlx::query("UPDATE quests SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
        .bind(id)
        .execute(&db.0)
        .await?;
    Ok(())
}

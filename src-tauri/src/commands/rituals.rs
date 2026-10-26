use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{Ritual, RitualCompletion, RitualFields};

macro_rules! select_rituals {
    ($tail:literal) => {
        concat!(
            "SELECT id, title, real_name, attribute, schedule, weekdays_mask, times_per_week, interval_days, ",
            "start_date, paused_until, difficulty, sort_order, created_at, archived_at FROM rituals ",
            $tail
        )
    };
}

async fn fetch(pool: &SqlitePool, id: i64) -> AppResult<Ritual> {
    sqlx::query_as::<_, Ritual>(select_rituals!("WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("ритуал {id}")))
}

fn validate(fields: &RitualFields) -> AppResult<()> {
    if fields.title.trim().is_empty() {
        return Err(AppError::Invalid("у ритуала должно быть название".into()));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_rituals(db: State<'_, Db>) -> AppResult<Vec<Ritual>> {
    Ok(sqlx::query_as::<_, Ritual>(select_rituals!("WHERE archived_at IS NULL ORDER BY sort_order, id"))
        .fetch_all(&db.0)
        .await?)
}

pub async fn create(pool: &SqlitePool, fields: RitualFields) -> AppResult<Ritual> {
    validate(&fields)?;
    let id = sqlx::query(
        "INSERT INTO rituals (title, real_name, attribute, schedule, weekdays_mask, times_per_week, \
         interval_days, start_date, paused_until, difficulty, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(fields.title.trim())
    .bind(&fields.real_name)
    .bind(&fields.attribute)
    .bind(&fields.schedule)
    .bind(fields.weekdays_mask)
    .bind(fields.times_per_week)
    .bind(fields.interval_days)
    .bind(&fields.start_date)
    .bind(&fields.paused_until)
    .bind(fields.difficulty)
    .bind(fields.sort_order)
    .execute(pool)
    .await?
    .last_insert_rowid();
    fetch(pool, id).await
}

#[tauri::command]
pub async fn create_ritual(db: State<'_, Db>, fields: RitualFields) -> AppResult<Ritual> {
    create(&db.0, fields).await
}

#[tauri::command]
pub async fn update_ritual(db: State<'_, Db>, id: i64, fields: RitualFields) -> AppResult<Ritual> {
    validate(&fields)?;
    let affected = sqlx::query(
        "UPDATE rituals SET title = ?, real_name = ?, attribute = ?, schedule = ?, weekdays_mask = ?, \
         times_per_week = ?, interval_days = ?, start_date = ?, paused_until = ?, difficulty = ?, sort_order = ? \
         WHERE id = ? AND archived_at IS NULL",
    )
    .bind(fields.title.trim())
    .bind(&fields.real_name)
    .bind(&fields.attribute)
    .bind(&fields.schedule)
    .bind(fields.weekdays_mask)
    .bind(fields.times_per_week)
    .bind(fields.interval_days)
    .bind(&fields.start_date)
    .bind(&fields.paused_until)
    .bind(fields.difficulty)
    .bind(fields.sort_order)
    .bind(id)
    .execute(&db.0)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::NotFound(format!("ритуал {id}")));
    }
    fetch(&db.0, id).await
}

#[tauri::command]
pub async fn archive_ritual(db: State<'_, Db>, id: i64) -> AppResult<()> {
    sqlx::query("UPDATE rituals SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
        .bind(id)
        .execute(&db.0)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn list_ritual_completions(db: State<'_, Db>, since: String) -> AppResult<Vec<RitualCompletion>> {
    Ok(sqlx::query_as::<_, RitualCompletion>(
        "SELECT ritual_id, game_date, completed_at FROM ritual_completions WHERE game_date >= ? ORDER BY game_date",
    )
    .bind(since)
    .fetch_all(&db.0)
    .await?)
}

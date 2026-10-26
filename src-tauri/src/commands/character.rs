use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::Character;

const SELECT: &str = "SELECT name, title, level, xp, gold, strength, intellect, agility, \
    streak_current, streak_best, wind_step, fatigued_since, location_key, created_at, updated_at \
    FROM character WHERE id = 1";

pub async fn fetch(pool: &SqlitePool) -> AppResult<Character> {
    sqlx::query_as::<_, Character>(SELECT)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("персонаж".into()))
}

#[tauri::command]
pub async fn get_character(db: State<'_, Db>) -> AppResult<Character> {
    fetch(&db.0).await
}

#[tauri::command]
pub async fn rename_character(db: State<'_, Db>, name: String) -> AppResult<Character> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 60 {
        return Err(AppError::Invalid("имя героя: от 1 до 60 символов".into()));
    }
    sqlx::query(
        "UPDATE character SET name = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1",
    )
    .bind(name)
    .execute(&db.0)
    .await?;
    fetch(&db.0).await
}

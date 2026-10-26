use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::AppResult;
use crate::models::Achievement;

pub async fn list(pool: &SqlitePool) -> AppResult<Vec<Achievement>> {
    Ok(sqlx::query_as::<_, Achievement>("SELECT key, unlocked_at FROM achievements ORDER BY unlocked_at, key")
        .fetch_all(pool)
        .await?)
}

#[tauri::command]
pub async fn list_achievements(db: State<'_, Db>) -> AppResult<Vec<Achievement>> {
    list(&db.0).await
}

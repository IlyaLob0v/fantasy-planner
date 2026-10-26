use tauri::State;

use crate::db::Db;
use crate::error::AppResult;
use crate::models::Day;

#[tauri::command]
pub async fn list_days(db: State<'_, Db>, since: String) -> AppResult<Vec<Day>> {
    Ok(sqlx::query_as::<_, Day>(
        "SELECT game_date, kind, deeds_count, closed_at FROM days WHERE game_date >= ? ORDER BY game_date",
    )
    .bind(since)
    .fetch_all(&db.0)
    .await?)
}

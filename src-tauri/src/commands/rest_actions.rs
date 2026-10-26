use tauri::State;

use crate::db::Db;
use crate::error::AppResult;
use crate::models::RestAction;

#[tauri::command]
pub async fn list_rest_actions(db: State<'_, Db>) -> AppResult<Vec<RestAction>> {
    Ok(sqlx::query_as::<_, RestAction>(
        "SELECT id, title FROM rest_actions WHERE archived_at IS NULL ORDER BY id",
    )
    .fetch_all(&db.0)
    .await?)
}

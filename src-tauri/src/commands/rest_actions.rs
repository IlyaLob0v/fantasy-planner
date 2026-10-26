use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::RestAction;

#[tauri::command]
pub async fn list_rest_actions(db: State<'_, Db>) -> AppResult<Vec<RestAction>> {
    Ok(sqlx::query_as::<_, RestAction>(
        "SELECT id, title FROM rest_actions WHERE archived_at IS NULL ORDER BY id",
    )
    .fetch_all(&db.0)
    .await?)
}

#[tauri::command]
pub async fn create_rest_action(db: State<'_, Db>, title: String) -> AppResult<RestAction> {
    let title = title.trim();
    if title.is_empty() {
        return Err(AppError::Invalid("у привала должно быть название".into()));
    }
    let id = sqlx::query("INSERT INTO rest_actions (title) VALUES (?)")
        .bind(title)
        .execute(&db.0)
        .await?
        .last_insert_rowid();
    Ok(RestAction { id, title: title.to_owned() })
}

#[tauri::command]
pub async fn archive_rest_action(db: State<'_, Db>, id: i64) -> AppResult<()> {
    sqlx::query("UPDATE rest_actions SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
        .bind(id)
        .execute(&db.0)
        .await?;
    Ok(())
}

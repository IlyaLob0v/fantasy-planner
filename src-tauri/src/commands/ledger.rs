use tauri::State;

use crate::db::Db;
use crate::error::AppResult;
use crate::models::LedgerEntry;

#[tauri::command]
pub async fn list_ledger_for_date(db: State<'_, Db>, game_date: String) -> AppResult<Vec<LedgerEntry>> {
    Ok(sqlx::query_as::<_, LedgerEntry>(
        "SELECT id, occurred_at, game_date, source_type, source_id, xp_delta, gold_delta, attribute, \
         attribute_delta, reverts_id, note FROM ledger WHERE game_date = ? ORDER BY id",
    )
    .bind(game_date)
    .fetch_all(&db.0)
    .await?)
}

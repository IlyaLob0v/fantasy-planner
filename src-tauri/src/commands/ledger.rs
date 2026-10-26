use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::AppResult;
use crate::models::{LedgerEntry, LedgerTally};

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

/// Журнал с указанной даты: из него считаются цели и летопись недели.
#[tauri::command]
pub async fn list_ledger_since(db: State<'_, Db>, since: String) -> AppResult<Vec<LedgerEntry>> {
    Ok(sqlx::query_as::<_, LedgerEntry>(
        "SELECT id, occurred_at, game_date, source_type, source_id, xp_delta, gold_delta, attribute, \
         attribute_delta, reverts_id, note FROM ledger WHERE game_date >= ? ORDER BY id",
    )
    .bind(since)
    .fetch_all(&db.0)
    .await?)
}

/// Счётчики журнала по источникам. Отменённые записи и сами отмены не считаются.
pub async fn tally(pool: &SqlitePool) -> AppResult<Vec<LedgerTally>> {
    Ok(sqlx::query_as::<_, LedgerTally>(
        "SELECT source_type, source_id, COUNT(*) AS count FROM ledger AS entry \
         WHERE source_type <> 'revert' \
         AND NOT EXISTS (SELECT 1 FROM ledger AS undo WHERE undo.reverts_id = entry.id) \
         GROUP BY source_type, source_id ORDER BY source_type, source_id",
    )
    .fetch_all(pool)
    .await?)
}

#[tauri::command]
pub async fn ledger_tally(db: State<'_, Db>) -> AppResult<Vec<LedgerTally>> {
    tally(&db.0).await
}

use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::InventoryItem;

#[tauri::command]
pub async fn list_inventory(db: State<'_, Db>) -> AppResult<Vec<InventoryItem>> {
    Ok(sqlx::query_as::<_, InventoryItem>(
        "SELECT id, item_type, item_name, rarity, asset_key, source_type, source_id, obtained_at, redeemed_at \
         FROM inventory ORDER BY obtained_at DESC, id DESC",
    )
    .fetch_all(&db.0)
    .await?)
}

/// Отмечает реальную награду как использованную. Золото здесь не трогается: оно списано при покупке.
#[tauri::command]
pub async fn redeem_item(db: State<'_, Db>, id: i64) -> AppResult<()> {
    let affected = sqlx::query(
        "UPDATE inventory SET redeemed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') \
         WHERE id = ? AND item_type = 'reward' AND redeemed_at IS NULL",
    )
    .bind(id)
    .execute(&db.0)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::NotFound(format!("предмет {id}")));
    }
    Ok(())
}

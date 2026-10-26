use tauri::State;

use crate::commands::character;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{Character, Location};

#[tauri::command]
pub async fn list_locations(db: State<'_, Db>) -> AppResult<Vec<Location>> {
    Ok(sqlx::query_as::<_, Location>(
        "SELECT key, name, asset_key, unlock_level, price, sort_order FROM locations ORDER BY sort_order",
    )
    .fetch_all(&db.0)
    .await?)
}

/// Делает локацию домом. Проверяет только факт владения: бесплатная локация или купленная строка в инвентаре.
#[tauri::command]
pub async fn set_home(db: State<'_, Db>, key: String) -> AppResult<Character> {
    let owned: Option<(String,)> = sqlx::query_as(
        "SELECT key FROM locations WHERE key = ? AND (price = 0 OR EXISTS \
         (SELECT 1 FROM inventory WHERE item_type = 'location' AND asset_key = locations.asset_key))",
    )
    .bind(&key)
    .fetch_optional(&db.0)
    .await?;
    if owned.is_none() {
        return Err(AppError::Invalid("эта локация ещё не открыта".into()));
    }
    sqlx::query(
        "UPDATE character SET location_key = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1",
    )
    .bind(&key)
    .execute(&db.0)
    .await?;
    character::fetch(&db.0).await
}

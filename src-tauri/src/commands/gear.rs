use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{EquipmentSlot, Gear};

pub async fn list(pool: &SqlitePool) -> AppResult<Vec<Gear>> {
    Ok(sqlx::query_as::<_, Gear>(
        "SELECT id, item_key, source_type, source_id, game_date, misses_before, obtained_at FROM gear ORDER BY id",
    )
    .fetch_all(pool)
    .await?)
}

pub async fn equipment(pool: &SqlitePool) -> AppResult<Vec<EquipmentSlot>> {
    Ok(sqlx::query_as::<_, EquipmentSlot>("SELECT slot, gear_id FROM equipment ORDER BY slot")
        .fetch_all(pool)
        .await?)
}

/// Надевает предмет в слот или снимает (gear_id = None). Подходит ли предмет к слоту, проверяет TS по каталогу.
pub async fn equip(pool: &SqlitePool, slot: &str, gear_id: Option<i64>) -> AppResult<Vec<EquipmentSlot>> {
    let affected = sqlx::query(
        "UPDATE equipment SET gear_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE slot = ?",
    )
    .bind(gear_id)
    .bind(slot)
    .execute(pool)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::NotFound(format!("слот {slot}")));
    }
    equipment(pool).await
}

#[tauri::command]
pub async fn list_gear(db: State<'_, Db>) -> AppResult<Vec<Gear>> {
    list(&db.0).await
}

#[tauri::command]
pub async fn list_equipment(db: State<'_, Db>) -> AppResult<Vec<EquipmentSlot>> {
    equipment(&db.0).await
}

#[tauri::command]
pub async fn set_equipment(db: State<'_, Db>, slot: String, gear_id: Option<i64>) -> AppResult<Vec<EquipmentSlot>> {
    equip(&db.0, &slot, gear_id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_memory;

    #[tokio::test]
    async fn equip_and_lose_on_undo() -> AppResult<()> {
        let pool = open_memory().await?;
        sqlx::query("INSERT INTO gear (uid, item_key, source_type, source_id, game_date) VALUES ('u1', 'wanderer_dagger', 'quest', 1, '2026-10-26')")
            .execute(&pool)
            .await?;
        let found = list(&pool).await?;
        let id = found.first().map(|g| g.id);
        let slots = equip(&pool, "weapon", id).await?;
        assert_eq!(slots.iter().find(|s| s.slot == "weapon").and_then(|s| s.gear_id), id);
        sqlx::query("DELETE FROM gear").execute(&pool).await?;
        let slots = equipment(&pool).await?;
        assert!(slots.iter().all(|s| s.gear_id.is_none()));
        assert!(equip(&pool, "boots", None).await.is_err());
        Ok(())
    }
}

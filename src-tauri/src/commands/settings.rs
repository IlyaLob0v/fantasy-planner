use std::collections::HashMap;

use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};

#[tauri::command]
pub async fn get_settings(db: State<'_, Db>) -> AppResult<HashMap<String, serde_json::Value>> {
    let rows: Vec<(String, String)> = sqlx::query_as("SELECT key, value FROM settings")
        .fetch_all(&db.0)
        .await?;
    rows.into_iter()
        .map(|(key, raw)| {
            serde_json::from_str(&raw)
                .map(|value| (key.clone(), value))
                .map_err(|err| AppError::Invalid(format!("настройка {key}: {err}")))
        })
        .collect()
}

const EDITABLE: &[&str] = &["day_start_hour", "rates", "rest_price", "motion", "oath_done", "hints_seen", "loot", "forge_prices", "week", "recap_seen", "crest", "crest_price", "starter_pack", "journey", "return_seen", "reminder", "saga_every_days"];

#[tauri::command]
pub async fn set_setting(db: State<'_, Db>, key: String, value: serde_json::Value) -> AppResult<()> {
    if !EDITABLE.contains(&key.as_str()) {
        return Err(AppError::Invalid(format!("настройку {key} нельзя менять")));
    }
    sqlx::query("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(&key)
        .bind(value.to_string())
        .execute(&db.0)
        .await?;
    Ok(())
}

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

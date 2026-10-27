use serde_json::{Map, Value};
use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};

/// Что выгружается в летопись: все данные героя. Список закрытый, поэтому имена можно подставлять в запрос.
const TABLES: &[&str] = &[
    "character",
    "settings",
    "quests",
    "quest_steps",
    "ledger",
    "days",
    "rituals",
    "ritual_completions",
    "rewards",
    "rest_actions",
    "inventory",
    "chronicle",
    "locations",
    "achievements",
    "gear",
    "equipment",
    "week_goals",
    "crest_parts",
    "saga_chapters",
    "inn_stays",
];

/// Формат файла летописи; растёт, если поменяется устройство файла.
const FORMAT: i64 = 1;

async fn table(pool: &SqlitePool, name: &str) -> AppResult<Value> {
    let (columns,): (Option<String>,) =
        sqlx::query_as("SELECT group_concat(quote(name) || ', ' || '\"' || name || '\"', ', ') FROM pragma_table_info(?)")
            .bind(name)
            .fetch_one(pool)
            .await?;
    let columns = columns.ok_or_else(|| AppError::NotFound(format!("таблица {name}")))?;
    let sql = format!("SELECT COALESCE(json_group_array(json_object({columns})), '[]') FROM \"{name}\"");
    // Имя таблицы из закрытого списка TABLES, столбцы из схемы самой базы: ввода пользователя здесь нет.
    let (rows,): (String,) = sqlx::query_as(sqlx::AssertSqlSafe(sql)).fetch_one(pool).await?;
    serde_json::from_str(&rows).map_err(|e| AppError::Invalid(format!("летопись {name}: {e}")))
}

/// Летопись: все таблицы героя одним JSON-документом. Куда сохранить, решает TS через диалог.
pub async fn export(pool: &SqlitePool) -> AppResult<String> {
    let mut tables = Map::new();
    for name in TABLES {
        tables.insert((*name).to_string(), table(pool, name).await?);
    }
    let (exported_at,): (String,) = sqlx::query_as("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')").fetch_one(pool).await?;
    let mut doc = Map::new();
    doc.insert("app".into(), Value::from("fantasy-planner"));
    doc.insert("format".into(), Value::from(FORMAT));
    doc.insert("exportedAt".into(), Value::from(exported_at));
    doc.insert("tables".into(), Value::Object(tables));
    serde_json::to_string_pretty(&Value::Object(doc)).map_err(|e| AppError::Invalid(format!("летопись: {e}")))
}

#[tauri::command]
pub async fn export_data(db: State<'_, Db>) -> AppResult<String> {
    export(&db.0).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[tokio::test]
    async fn every_table_is_exported() -> AppResult<()> {
        let pool = db::open_memory().await?;
        let text = export(&pool).await?;
        let doc: Value = serde_json::from_str(&text).map_err(|e| AppError::Invalid(e.to_string()))?;
        let tables = doc["tables"].as_object().ok_or_else(|| AppError::Invalid("нет tables".into()))?;
        assert_eq!(tables.len(), TABLES.len());
        assert_eq!(doc["tables"]["character"][0]["name"], "Странник");
        assert!(doc["tables"]["quests"].as_array().is_some_and(Vec::is_empty));
        assert!(doc["tables"]["settings"].as_array().is_some_and(|s| !s.is_empty()));
        Ok(())
    }
}

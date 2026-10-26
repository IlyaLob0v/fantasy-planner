use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{Reward, RewardFields};

const SELECT_ONE: &str =
    "SELECT id, title, description, price, repeatable, created_at, archived_at FROM rewards WHERE id = ?";

async fn fetch(pool: &SqlitePool, id: i64) -> AppResult<Reward> {
    sqlx::query_as::<_, Reward>(SELECT_ONE)
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("награда {id}")))
}

fn validate(fields: &RewardFields) -> AppResult<()> {
    if fields.title.trim().is_empty() {
        return Err(AppError::Invalid("у награды должно быть название".into()));
    }
    if fields.price <= 0 {
        return Err(AppError::Invalid("цена награды должна быть больше нуля".into()));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_rewards(db: State<'_, Db>) -> AppResult<Vec<Reward>> {
    Ok(sqlx::query_as::<_, Reward>(
        "SELECT id, title, description, price, repeatable, created_at, archived_at FROM rewards \
         WHERE archived_at IS NULL ORDER BY price, id",
    )
    .fetch_all(&db.0)
    .await?)
}

#[tauri::command]
pub async fn create_reward(db: State<'_, Db>, fields: RewardFields) -> AppResult<Reward> {
    validate(&fields)?;
    let id = sqlx::query("INSERT INTO rewards (title, description, price, repeatable) VALUES (?, ?, ?, ?)")
        .bind(fields.title.trim())
        .bind(&fields.description)
        .bind(fields.price)
        .bind(fields.repeatable)
        .execute(&db.0)
        .await?
        .last_insert_rowid();
    fetch(&db.0, id).await
}

#[tauri::command]
pub async fn update_reward(db: State<'_, Db>, id: i64, fields: RewardFields) -> AppResult<Reward> {
    validate(&fields)?;
    let affected = sqlx::query(
        "UPDATE rewards SET title = ?, description = ?, price = ?, repeatable = ? WHERE id = ? AND archived_at IS NULL",
    )
    .bind(fields.title.trim())
    .bind(&fields.description)
    .bind(fields.price)
    .bind(fields.repeatable)
    .bind(id)
    .execute(&db.0)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::NotFound(format!("награда {id}")));
    }
    fetch(&db.0, id).await
}

#[tauri::command]
pub async fn archive_reward(db: State<'_, Db>, id: i64) -> AppResult<()> {
    sqlx::query("UPDATE rewards SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
        .bind(id)
        .execute(&db.0)
        .await?;
    Ok(())
}

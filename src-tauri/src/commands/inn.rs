use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::InnStay;

pub async fn list(pool: &SqlitePool) -> AppResult<Vec<InnStay>> {
    Ok(sqlx::query_as::<_, InnStay>(
        "SELECT id, start_date, end_date, created_at FROM inn_stays WHERE deleted_at IS NULL ORDER BY start_date",
    )
    .fetch_all(pool)
    .await?)
}

#[tauri::command]
pub async fn list_inn_stays(db: State<'_, Db>) -> AppResult<Vec<InnStay>> {
    list(&db.0).await
}

/// Возвращение из таверны раньше срока: новая дата конца или отмена комнаты, которая ещё не началась.
/// Какую дату ставить, решает TS; здесь только запись.
pub async fn end(pool: &SqlitePool, id: i64, end_date: Option<&str>) -> AppResult<Vec<InnStay>> {
    let affected = match end_date {
        Some(date) => sqlx::query(
            "UPDATE inn_stays SET end_date = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') \
             WHERE id = ? AND deleted_at IS NULL AND start_date <= ?",
        )
        .bind(date)
        .bind(id)
        .bind(date)
        .execute(pool)
        .await?
        .rows_affected(),
        None => sqlx::query(
            "UPDATE inn_stays SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), \
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(id)
        .execute(pool)
        .await?
        .rows_affected(),
    };
    if affected == 0 {
        return Err(AppError::NotFound(format!("комната в таверне {id}")));
    }
    list(pool).await
}

#[tauri::command]
pub async fn end_inn_stay(db: State<'_, Db>, id: i64, end_date: Option<String>) -> AppResult<Vec<InnStay>> {
    end(&db.0, id, end_date.as_deref()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn insert(pool: &SqlitePool, uid: &str, start: &str, end: &str) -> AppResult<i64> {
        let (id,): (i64,) = sqlx::query_as("INSERT INTO inn_stays (uid, start_date, end_date) VALUES (?, ?, ?) RETURNING id")
            .bind(uid)
            .bind(start)
            .bind(end)
            .fetch_one(pool)
            .await?;
        Ok(id)
    }

    #[tokio::test]
    async fn stay_ends_early_or_is_cancelled() -> AppResult<()> {
        let pool = db::open_memory().await?;
        let started = insert(&pool, "u1", "2026-10-20", "2026-10-30").await?;
        let stays = end(&pool, started, Some("2026-10-26")).await?;
        assert_eq!(stays.len(), 1);
        assert_eq!(stays[0].end_date, "2026-10-26");

        let ahead = insert(&pool, "u2", "2026-11-05", "2026-11-07").await?;
        let stays = end(&pool, ahead, None).await?;
        assert_eq!(stays.len(), 1);
        assert!(end(&pool, ahead, None).await.is_err());
        Ok(())
    }

    #[tokio::test]
    async fn end_date_never_before_start() -> AppResult<()> {
        let pool = db::open_memory().await?;
        let id = insert(&pool, "u1", "2026-10-27", "2026-10-30").await?;
        assert!(end(&pool, id, Some("2026-10-26")).await.is_err());
        Ok(())
    }
}

use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::AppResult;
use crate::models::{NewSagaChapter, SagaChapter};

pub async fn list(pool: &SqlitePool) -> AppResult<Vec<SagaChapter>> {
    Ok(sqlx::query_as::<_, SagaChapter>("SELECT key, unlocked_at, read_at FROM saga_chapters ORDER BY key")
        .fetch_all(pool)
        .await?)
}

#[tauri::command]
pub async fn list_saga_chapters(db: State<'_, Db>) -> AppResult<Vec<SagaChapter>> {
    list(&db.0).await
}

/// Записывает открытые главы; уже открытая глава не трогается.
pub async fn unlock(pool: &SqlitePool, chapters: &[NewSagaChapter]) -> AppResult<Vec<SagaChapter>> {
    let mut tx = pool.begin().await?;
    for chapter in chapters {
        sqlx::query("INSERT INTO saga_chapters (key, uid) VALUES (?, ?) ON CONFLICT(key) DO NOTHING")
            .bind(&chapter.key)
            .bind(&chapter.uid)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    list(pool).await
}

#[tauri::command]
pub async fn unlock_saga_chapters(db: State<'_, Db>, chapters: Vec<NewSagaChapter>) -> AppResult<Vec<SagaChapter>> {
    unlock(&db.0, &chapters).await
}

/// Отмечает главу прочитанной один раз; повторное чтение дату не меняет.
pub async fn read(pool: &SqlitePool, key: &str) -> AppResult<Vec<SagaChapter>> {
    sqlx::query(
        "UPDATE saga_chapters SET read_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') \
         WHERE key = ? AND read_at IS NULL",
    )
    .bind(key)
    .execute(pool)
    .await?;
    list(pool).await
}

#[tauri::command]
pub async fn read_saga_chapter(db: State<'_, Db>, key: String) -> AppResult<Vec<SagaChapter>> {
    read(&db.0, &key).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[tokio::test]
    async fn chapters_unlock_once_and_stay_read() -> AppResult<()> {
        let pool = db::open_memory().await?;
        let first = NewSagaChapter { key: "saga_01".into(), uid: "u1".into() };
        unlock(&pool, std::slice::from_ref(&first)).await?;
        let again = unlock(&pool, &[NewSagaChapter { key: "saga_01".into(), uid: "u2".into() }]).await?;
        assert_eq!(again.len(), 1);
        let read_once = read(&pool, "saga_01").await?;
        let read_at = read_once[0].read_at.clone();
        assert!(read_at.is_some());
        let read_twice = read(&pool, "saga_01").await?;
        assert_eq!(read_twice[0].read_at, read_at);
        Ok(())
    }
}

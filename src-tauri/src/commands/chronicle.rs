use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::ChronicleEntry;

const LIMIT: usize = 2000;

pub async fn list(pool: &SqlitePool) -> AppResult<Vec<ChronicleEntry>> {
    Ok(sqlx::query_as::<_, ChronicleEntry>(
        "SELECT game_date, happened, noticed, feeling, mood, updated_at FROM chronicle ORDER BY game_date DESC",
    )
    .fetch_all(pool)
    .await?)
}

pub async fn save(pool: &SqlitePool, entry: ChronicleEntry) -> AppResult<ChronicleEntry> {
    if [&entry.happened, &entry.noticed, &entry.feeling].iter().any(|t| t.chars().count() > LIMIT) {
        return Err(AppError::Invalid(format!("запись хроники длиннее {LIMIT} символов")));
    }
    if entry.mood.is_some_and(|m| !(1..=5).contains(&m)) {
        return Err(AppError::Invalid("настроение: от 1 до 5".into()));
    }
    Ok(sqlx::query_as::<_, ChronicleEntry>(
        "INSERT INTO chronicle (game_date, happened, noticed, feeling, mood) VALUES (?, ?, ?, ?, ?) \
         ON CONFLICT(game_date) DO UPDATE SET happened = excluded.happened, noticed = excluded.noticed, \
         feeling = excluded.feeling, mood = excluded.mood, \
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') \
         RETURNING game_date, happened, noticed, feeling, mood, updated_at",
    )
    .bind(&entry.game_date)
    .bind(&entry.happened)
    .bind(&entry.noticed)
    .bind(&entry.feeling)
    .bind(entry.mood)
    .fetch_one(pool)
    .await?)
}

#[tauri::command]
pub async fn list_chronicle(db: State<'_, Db>) -> AppResult<Vec<ChronicleEntry>> {
    list(&db.0).await
}

#[tauri::command]
pub async fn save_chronicle(db: State<'_, Db>, entry: ChronicleEntry) -> AppResult<ChronicleEntry> {
    save(&db.0, entry).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_memory;

    fn entry(happened: &str) -> ChronicleEntry {
        ChronicleEntry {
            game_date: "2026-10-26".into(),
            happened: happened.into(),
            noticed: String::new(),
            feeling: String::new(),
            mood: Some(4),
            updated_at: String::new(),
        }
    }

    #[tokio::test]
    async fn chronicle_upserts_one_entry_per_day() -> AppResult<()> {
        let pool = open_memory().await?;
        save(&pool, entry("Сдал отчёт")).await?;
        save(&pool, entry("Сдал отчёт и погулял")).await?;
        let all = list(&pool).await?;
        assert_eq!(all.len(), 1);
        assert_eq!(all.first().map(|e| e.happened.as_str()), Some("Сдал отчёт и погулял"));
        assert!(save(&pool, ChronicleEntry { mood: Some(9), ..entry("") }).await.is_err());
        Ok(())
    }
}

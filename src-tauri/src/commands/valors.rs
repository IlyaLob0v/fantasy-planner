use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{Valor, ValorFields};

macro_rules! select_valors {
    ($tail:literal) => {
        concat!("SELECT id, title, real_name, attribute, sort_order, created_at, archived_at FROM valors ", $tail)
    };
}

async fn fetch(pool: &SqlitePool, id: i64) -> AppResult<Valor> {
    sqlx::query_as::<_, Valor>(select_valors!("WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("доблесть {id}")))
}

fn validate(fields: &ValorFields) -> AppResult<()> {
    if fields.title.trim().is_empty() {
        return Err(AppError::Invalid("у доблести должно быть название".into()));
    }
    Ok(())
}

#[tauri::command]
pub async fn list_valors(db: State<'_, Db>) -> AppResult<Vec<Valor>> {
    Ok(sqlx::query_as::<_, Valor>(select_valors!("WHERE archived_at IS NULL ORDER BY sort_order, id"))
        .fetch_all(&db.0)
        .await?)
}

pub async fn create(pool: &SqlitePool, fields: ValorFields) -> AppResult<Valor> {
    validate(&fields)?;
    let id = sqlx::query("INSERT INTO valors (title, real_name, attribute, sort_order) VALUES (?, ?, ?, ?)")
        .bind(fields.title.trim())
        .bind(&fields.real_name)
        .bind(&fields.attribute)
        .bind(fields.sort_order)
        .execute(pool)
        .await?
        .last_insert_rowid();
    fetch(pool, id).await
}

#[tauri::command]
pub async fn create_valor(db: State<'_, Db>, fields: ValorFields) -> AppResult<Valor> {
    create(&db.0, fields).await
}

#[tauri::command]
pub async fn update_valor(db: State<'_, Db>, id: i64, fields: ValorFields) -> AppResult<Valor> {
    validate(&fields)?;
    let affected = sqlx::query("UPDATE valors SET title = ?, real_name = ?, attribute = ?, sort_order = ? WHERE id = ? AND archived_at IS NULL")
        .bind(fields.title.trim())
        .bind(&fields.real_name)
        .bind(&fields.attribute)
        .bind(fields.sort_order)
        .bind(id)
        .execute(&db.0)
        .await?
        .rows_affected();
    if affected == 0 {
        return Err(AppError::NotFound(format!("доблесть {id}")));
    }
    fetch(&db.0, id).await
}

/// Доблесть уходит из зала, но её отметки остаются в журнале.
#[tauri::command]
pub async fn archive_valor(db: State<'_, Db>, id: i64) -> AppResult<()> {
    sqlx::query("UPDATE valors SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND archived_at IS NULL")
        .bind(id)
        .execute(&db.0)
        .await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    fn fields(title: &str) -> ValorFields {
        ValorFields { title: title.into(), real_name: Some("выпил воды".into()), attribute: "strength".into(), sort_order: 0 }
    }

    #[tokio::test]
    async fn valor_gets_a_uid_and_leaves_the_hall_when_archived() -> AppResult<()> {
        let pool = db::open_memory().await?;
        let valor = create(&pool, fields("  Глоток из родника ")).await?;
        assert_eq!(valor.title, "Глоток из родника");
        let (uid,): (String,) = sqlx::query_as("SELECT uid FROM valors WHERE id = ?").bind(valor.id).fetch_one(&pool).await?;
        assert!(!uid.is_empty());
        let (queued,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sync_outbox WHERE tbl = 'valors' AND key = ?").bind(&uid).fetch_one(&pool).await?;
        assert_eq!(queued, 1);
        assert!(create(&pool, fields("  ")).await.is_err());
        sqlx::query("UPDATE valors SET archived_at = '2026-10-28T00:00:00Z' WHERE id = ?").bind(valor.id).execute(&pool).await?;
        let (visible,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM valors WHERE archived_at IS NULL").fetch_one(&pool).await?;
        assert_eq!(visible, 0);
        Ok(())
    }

    #[tokio::test]
    async fn ledger_takes_valor_marks_and_keeps_its_uid_trigger() -> AppResult<()> {
        let pool = db::open_memory().await?;
        let valor = create(&pool, fields("Страница из свитка")).await?;
        sqlx::query("INSERT INTO ledger (game_date, source_type, source_id, xp_delta, gold_delta) VALUES ('2026-10-28', 'valor', ?, 2, 1)")
            .bind(valor.id)
            .execute(&pool)
            .await?;
        let (uid,): (Option<String>,) = sqlx::query_as("SELECT uid FROM ledger WHERE source_type = 'valor'").fetch_one(&pool).await?;
        assert!(uid.is_some_and(|u| !u.is_empty()));
        Ok(())
    }
}

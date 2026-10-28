use std::path::Path;
use std::str::FromStr;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous};
use sqlx::SqlitePool;

use crate::error::AppResult;

pub struct Db(pub SqlitePool);

/// Открывает базу (создаёт при первом запуске) и применяет миграции из `migrations/`.
pub async fn open(path: &Path) -> AppResult<SqlitePool> {
    let url = format!("sqlite://{}", path.display());
    let options = SqliteConnectOptions::from_str(&url)?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new().max_connections(4).connect_with(options).await?;
    migrate(&pool).await?;
    Ok(pool)
}

pub async fn migrate(pool: &SqlitePool) -> AppResult<()> {
    sqlx::migrate!("./migrations").run(pool).await?;
    Ok(())
}

#[cfg(test)]
pub async fn open_memory() -> AppResult<SqlitePool> {
    let options = SqliteConnectOptions::from_str("sqlite::memory:")?.foreign_keys(true);
    let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await?;
    migrate(&pool).await?;
    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Пересборка журнала в 0004 сохраняет строки, id и связи отмен, а старая база получает Присягу пройденной.
    #[tokio::test]
    async fn glory_migration_keeps_the_ledger() -> AppResult<()> {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")?.foreign_keys(true);
        let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await?;
        let migrator = sqlx::migrate!("./migrations");
        migrator.run_to(3, &pool).await?;
        sqlx::query("INSERT INTO ledger (id, game_date, source_type, gold_delta) VALUES (7, '2026-10-20', 'quest', 3)")
            .execute(&pool)
            .await?;
        sqlx::query("INSERT INTO ledger (id, game_date, source_type, gold_delta, reverts_id) VALUES (8, '2026-10-20', 'revert', -3, 7)")
            .execute(&pool)
            .await?;
        migrator.run(&pool).await?;
        let rows: Vec<(i64, Option<i64>)> = sqlx::query_as("SELECT id, reverts_id FROM ledger ORDER BY id").fetch_all(&pool).await?;
        assert_eq!(rows, vec![(7, None), (8, Some(7))]);
        let (oath,): (String,) = sqlx::query_as("SELECT value FROM settings WHERE key = 'oath_done'").fetch_one(&pool).await?;
        assert_eq!(oath, "true");
        sqlx::query("INSERT INTO ledger (game_date, source_type, gold_delta, note) VALUES ('2026-10-26', 'achievement', 25, 'first_quest')")
            .execute(&pool)
            .await?;
        Ok(())
    }

    /// Пересборка журнала в 0014 сохраняет строки, id, uid и связи отмен, ставка доблести появляется, триггер uid работает.
    #[tokio::test]
    async fn valor_migration_keeps_the_ledger_and_its_uids() -> AppResult<()> {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")?.foreign_keys(true);
        let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await?;
        let migrator = sqlx::migrate!("./migrations");
        migrator.run_to(13, &pool).await?;
        sqlx::query("INSERT INTO ledger (id, game_date, source_type, gold_delta, uid) VALUES (7, '2026-10-20', 'quest', 3, 'u-seven')")
            .execute(&pool)
            .await?;
        sqlx::query("INSERT INTO ledger (id, game_date, source_type, gold_delta, reverts_id, note) VALUES (8, '2026-10-20', 'revert', -3, 7, 'quest')")
            .execute(&pool)
            .await?;
        sqlx::query("INSERT INTO ledger (id, game_date, source_type, gold_delta, note) VALUES (9, '2026-10-21', 'achievement', 25, 'first_quest')")
            .execute(&pool)
            .await?;
        let (eight_uid,): (String,) = sqlx::query_as("SELECT uid FROM ledger WHERE id = 8").fetch_one(&pool).await?;
        migrator.run(&pool).await?;
        let rows: Vec<(i64, Option<i64>, String)> = sqlx::query_as("SELECT id, reverts_id, uid FROM ledger ORDER BY id").fetch_all(&pool).await?;
        assert_eq!(rows.len(), 3);
        assert_eq!(rows.first().map(|r| (r.0, r.1, r.2.as_str())), Some((7, None, "u-seven")));
        assert_eq!(rows.get(1).map(|r| (r.0, r.1, r.2.clone())), Some((8, Some(7), eight_uid)));
        let (rates,): (String,) = sqlx::query_as("SELECT value FROM settings WHERE key = 'rates'").fetch_one(&pool).await?;
        assert!(rates.contains("\"valor\":{\"xp\":2,\"gold\":1}"), "{rates}");
        let (outbox,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sync_outbox WHERE tbl = 'ledger'").fetch_one(&pool).await?;
        assert_eq!(outbox, 3);
        Ok(())
    }
}

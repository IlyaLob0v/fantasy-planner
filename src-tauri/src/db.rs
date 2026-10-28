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

    type Snapshot = (
        (String, i64, i64, i64),
        Vec<(i64, Option<i64>, String, String, String)>,
        Vec<(i64, i64, i64, Option<i64>)>,
        Vec<(String, i64)>,
        Vec<(i64, String)>,
        String,
    );

    async fn snapshot(pool: &SqlitePool) -> AppResult<Snapshot> {
        Ok((
            sqlx::query_as("SELECT name, level, xp, gold FROM character WHERE id = 1").fetch_one(pool).await?,
            sqlx::query_as("SELECT id, parent_id, type, title, status FROM quests ORDER BY id").fetch_all(pool).await?,
            sqlx::query_as("SELECT id, xp_delta, gold_delta, reverts_id FROM ledger ORDER BY id").fetch_all(pool).await?,
            sqlx::query_as("SELECT game_date, deeds_count FROM days ORDER BY game_date").fetch_all(pool).await?,
            sqlx::query_as("SELECT id, item_name FROM inventory ORDER BY id").fetch_all(pool).await?,
            sqlx::query_scalar("SELECT value FROM settings WHERE key = 'day_start_hour'").fetch_one(pool).await?,
        ))
    }

    /// Герой, начавший с V0.1, проходит все миграции по одной: ничего не теряется и связи целы.
    /// Обновление, съевшее прогресс, хуже любой ошибки, поэтому проверяется каждая ступень.
    #[tokio::test]
    async fn v01_hero_survives_every_migration() -> AppResult<()> {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")?.foreign_keys(true);
        let pool = SqlitePoolOptions::new().max_connections(1).connect_with(options).await?;
        let migrator = sqlx::migrate!("./migrations");
        migrator.run_to(1, &pool).await?;
        for sql in [
            "UPDATE character SET name = 'Илья', level = 3, xp = 140, gold = 37, strength = 2 WHERE id = 1",
            "INSERT INTO quests (id, type, title, attribute, difficulty, status, completed_at)
             VALUES (1, 'main', 'Сдать отчёт', 'intellect', 2, 'done', '2026-10-20T10:00:00.000Z')",
            "INSERT INTO quests (id, type, title, attribute, scheduled_date) VALUES (2, 'side', 'Зарядка', 'strength', '2026-10-21')",
            "INSERT INTO quests (id, type, title, attribute, due_date) VALUES (3, 'boss', 'Переезд', 'agility', '2026-11-30')",
            "INSERT INTO quests (id, parent_id, type, title, attribute, damage) VALUES (4, 3, 'stage', 'Коробки', 'agility', 2)",
            "INSERT INTO ledger (id, game_date, source_type, source_id, xp_delta, gold_delta, attribute, attribute_delta)
             VALUES (1, '2026-10-20', 'quest', 1, 60, 20, 'intellect', 1)",
            "INSERT INTO ledger (id, game_date, source_type, gold_delta) VALUES (2, '2026-10-20', 'purchase', -10)",
            "INSERT INTO ledger (id, game_date, source_type, gold_delta, reverts_id) VALUES (3, '2026-10-20', 'revert', 10, 2)",
            "INSERT INTO days (game_date, deeds_count, closed_at) VALUES ('2026-10-20', 1, '2026-10-21T04:00:00.000Z')",
            "INSERT INTO inventory (id, item_type, item_name) VALUES (1, 'reward', 'Вечер с книгой')",
            "UPDATE settings SET value = '6' WHERE key = 'day_start_hour'",
        ] {
            sqlx::query(sqlx::AssertSqlSafe(sql)).execute(&pool).await?;
        }
        let before = snapshot(&pool).await?;

        let versions: Vec<i64> = migrator.iter().map(|m| m.version).filter(|v| *v > 1).collect();
        assert!(!versions.is_empty());
        for version in versions {
            migrator.run_to(version, &pool).await?;
            assert_eq!(snapshot(&pool).await?, before, "миграция {version} изменила данные героя");
            let broken: Vec<(String,)> = sqlx::query_as("SELECT \"table\" FROM pragma_foreign_key_check").fetch_all(&pool).await?;
            assert!(broken.is_empty(), "миграция {version} порвала связи: {broken:?}");
        }
        let (integrity,): (String,) = sqlx::query_as("PRAGMA integrity_check").fetch_one(&pool).await?;
        assert_eq!(integrity, "ok");
        Ok(())
    }
}

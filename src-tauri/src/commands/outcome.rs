use sqlx::SqlitePool;
use tauri::State;

use crate::commands::character;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{Character, Outcome};

/// Записывает итог хода одной транзакцией: статус квеста, строки журнала, сутки, кэш персонажа.
/// Правила игры здесь не считаются: всё посчитано в TS-сервисах.
pub async fn commit(pool: &SqlitePool, outcome: Outcome) -> AppResult<Character> {
    let mut tx = pool.begin().await?;

    if let Some(change) = &outcome.quest {
        let affected = sqlx::query("UPDATE quests SET status = ?, completed_at = ? WHERE id = ?")
            .bind(&change.status)
            .bind(&change.completed_at)
            .bind(change.id)
            .execute(&mut *tx)
            .await?
            .rows_affected();
        if affected == 0 {
            return Err(AppError::NotFound(format!("квест {}", change.id)));
        }
    }

    for entry in &outcome.ledger {
        sqlx::query(
            "INSERT INTO ledger (game_date, source_type, source_id, xp_delta, gold_delta, attribute, \
             attribute_delta, reverts_id, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&entry.game_date)
        .bind(&entry.source_type)
        .bind(entry.source_id)
        .bind(entry.xp_delta)
        .bind(entry.gold_delta)
        .bind(&entry.attribute)
        .bind(entry.attribute_delta)
        .bind(entry.reverts_id)
        .bind(&entry.note)
        .execute(&mut *tx)
        .await?;
    }

    for day in &outcome.days {
        sqlx::query(
            "INSERT INTO days (game_date, kind, deeds_count, closed_at) VALUES (?, ?, ?, ?) \
             ON CONFLICT(game_date) DO UPDATE SET kind = excluded.kind, \
             deeds_count = excluded.deeds_count, closed_at = excluded.closed_at",
        )
        .bind(&day.game_date)
        .bind(&day.kind)
        .bind(day.deeds_count)
        .bind(&day.closed_at)
        .execute(&mut *tx)
        .await?;
    }

    let c = &outcome.character;
    sqlx::query(
        "UPDATE character SET title = ?, level = ?, xp = ?, gold = ?, strength = ?, intellect = ?, \
         agility = ?, streak_current = ?, streak_best = ?, wind_step = ?, fatigued_since = ?, \
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1",
    )
    .bind(&c.title)
    .bind(c.level)
    .bind(c.xp)
    .bind(c.gold)
    .bind(c.strength)
    .bind(c.intellect)
    .bind(c.agility)
    .bind(c.streak_current)
    .bind(c.streak_best)
    .bind(c.wind_step)
    .bind(&c.fatigued_since)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;
    character::fetch(pool).await
}

#[tauri::command]
pub async fn commit_outcome(db: State<'_, Db>, outcome: Outcome) -> AppResult<Character> {
    commit(&db.0, outcome).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::quests;
    use crate::db::open_memory;
    use crate::models::{CharacterState, Day, NewLedgerEntry, QuestFields, QuestStatusChange};

    fn fields() -> QuestFields {
        QuestFields {
            kind: "side".into(),
            title: "Наточить меч".into(),
            description: None,
            attribute: "strength".into(),
            difficulty: 2,
            scheduled_date: Some("2026-10-26".into()),
            due_date: None,
            sort_order: 0,
        }
    }

    fn state(xp: i64, gold: i64) -> CharacterState {
        CharacterState {
            title: Some("Странник".into()),
            level: 1,
            xp,
            gold,
            strength: 2,
            intellect: 0,
            agility: 0,
            streak_current: 1,
            streak_best: 1,
            wind_step: 0,
            fatigued_since: None,
        }
    }

    #[tokio::test]
    async fn migrations_seed_character_and_settings() -> AppResult<()> {
        let pool = open_memory().await?;
        let hero = character::fetch(&pool).await?;
        assert_eq!(hero.name, "Странник");
        assert_eq!(hero.gold, 0);
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM settings").fetch_one(&pool).await?;
        assert!(count >= 6);
        Ok(())
    }

    #[tokio::test]
    async fn commit_writes_everything_atomically() -> AppResult<()> {
        let pool = open_memory().await?;
        let quest = quests::create(&pool, fields()).await?;
        let outcome = Outcome {
            quest: Some(QuestStatusChange {
                id: quest.id,
                status: "done".into(),
                completed_at: Some("2026-10-26T10:00:00.000Z".into()),
            }),
            ledger: vec![NewLedgerEntry {
                game_date: "2026-10-26".into(),
                source_type: "quest".into(),
                source_id: Some(quest.id),
                xp_delta: 20,
                gold_delta: 6,
                attribute: Some("strength".into()),
                attribute_delta: 2,
                reverts_id: None,
                note: None,
            }],
            days: vec![Day {
                game_date: "2026-10-26".into(),
                kind: "normal".into(),
                deeds_count: 1,
                closed_at: None,
            }],
            character: state(20, 6),
        };
        let hero = commit(&pool, outcome).await?;
        assert_eq!((hero.xp, hero.gold, hero.strength), (20, 6, 2));
        let done = quests::list(&pool).await?;
        assert_eq!(done.first().map(|q| q.status.as_str()), Some("done"));
        Ok(())
    }

    #[tokio::test]
    async fn failed_commit_changes_nothing() -> AppResult<()> {
        let pool = open_memory().await?;
        let outcome = Outcome {
            quest: None,
            ledger: vec![],
            days: vec![],
            character: state(10, -5),
        };
        assert!(commit(&pool, outcome).await.is_err());
        let hero = character::fetch(&pool).await?;
        assert_eq!((hero.xp, hero.gold), (0, 0));
        Ok(())
    }
}

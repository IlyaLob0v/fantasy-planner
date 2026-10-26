use sqlx::SqlitePool;
use tauri::State;

use crate::commands::character;
use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{Character, Outcome};

/// Записывает итог хода одной транзакцией: статусы квестов, лут, строки журнала, сутки, кэш персонажа.
/// Правила игры здесь не считаются: всё посчитано в TS-сервисах.
pub async fn commit(pool: &SqlitePool, outcome: Outcome) -> AppResult<Character> {
    let mut tx = pool.begin().await?;

    for change in &outcome.quests {
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

    if let Some(mark) = &outcome.ritual {
        if mark.done {
            sqlx::query("INSERT INTO ritual_completions (ritual_id, game_date) VALUES (?, ?)")
                .bind(mark.ritual_id)
                .bind(&mark.game_date)
                .execute(&mut *tx)
                .await?;
        } else {
            sqlx::query("DELETE FROM ritual_completions WHERE ritual_id = ? AND game_date = ?")
                .bind(mark.ritual_id)
                .bind(&mark.game_date)
                .execute(&mut *tx)
                .await?;
        }
    }

    for id in &outcome.remove_inventory {
        sqlx::query("DELETE FROM inventory WHERE id = ? AND item_type = 'loot'")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }

    for item in &outcome.inventory {
        sqlx::query(
            "INSERT INTO inventory (item_type, item_name, rarity, asset_key, source_type, source_id) \
             VALUES (?, ?, ?, ?, ?, ?)",
        )
            .bind(&item.item_type)
            .bind(&item.item_name)
            .bind(&item.rarity)
            .bind(&item.asset_key)
            .bind(&item.source_type)
            .bind(item.source_id)
            .execute(&mut *tx)
            .await?;
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
    use crate::commands::rituals;
    use crate::models::{CharacterState, Day, NewInventoryItem, NewLedgerEntry, QuestFields, QuestStatusChange, RitualFields, RitualMark};

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
            parent_id: None,
            damage: 1,
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
            ritual: None,
            inventory: vec![],
            remove_inventory: vec![],
            quests: vec![QuestStatusChange {
                id: quest.id,
                status: "done".into(),
                completed_at: Some("2026-10-26T10:00:00.000Z".into()),
            }],
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
            ritual: None,
            inventory: vec![],
            quests: vec![],
            remove_inventory: vec![],
            ledger: vec![],
            days: vec![],
            character: state(10, -5),
        };
        assert!(commit(&pool, outcome).await.is_err());
        let hero = character::fetch(&pool).await?;
        assert_eq!((hero.xp, hero.gold), (0, 0));
        Ok(())
    }

    #[tokio::test]
    async fn ritual_marks_and_purchases_are_written() -> AppResult<()> {
        let pool = open_memory().await?;
        let ritual = rituals::create(
            &pool,
            RitualFields {
                title: "Утренняя молитва".into(),
                real_name: Some("зарядка".into()),
                attribute: "strength".into(),
                schedule: "weekdays".into(),
                weekdays_mask: Some(0b0011111),
                times_per_week: None,
                interval_days: None,
                start_date: "2026-10-26".into(),
                paused_until: None,
                difficulty: 1,
                sort_order: 0,
            },
        )
        .await?;
        let mark = |done: bool| Outcome {
            quests: vec![],
            remove_inventory: vec![],
            ritual: Some(RitualMark { ritual_id: ritual.id, game_date: "2026-10-26".into(), done }),
            inventory: vec![],
            ledger: vec![],
            days: vec![],
            character: state(5, 2),
        };
        commit(&pool, mark(true)).await?;
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ritual_completions").fetch_one(&pool).await?;
        assert_eq!(count, 1);
        commit(&pool, mark(false)).await?;
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM ritual_completions").fetch_one(&pool).await?;
        assert_eq!(count, 0);

        let purchase = Outcome {
            quests: vec![],
            remove_inventory: vec![],
            ritual: None,
            inventory: vec![NewInventoryItem {
                item_type: "reward".into(),
                item_name: "Вечер в таверне".into(),
                rarity: "common".into(),
                asset_key: None,
                source_type: Some("purchase".into()),
                source_id: Some(1),
            }],
            ledger: vec![],
            days: vec![],
            character: state(0, 0),
        };
        commit(&pool, purchase).await?;
        let (items,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM inventory").fetch_one(&pool).await?;
        assert_eq!(items, 1);
        Ok(())
    }

    #[tokio::test]
    async fn boss_defeat_and_its_undo_move_loot() -> AppResult<()> {
        let pool = open_memory().await?;
        let boss = quests::create(&pool, QuestFields { kind: "boss".into(), title: "Дипломная работа".into(), ..fields() }).await?;
        let stage = quests::create(
            &pool,
            QuestFields { kind: "stage".into(), title: "Введение".into(), parent_id: Some(boss.id), damage: 3, ..fields() },
        )
        .await?;
        let done = |id: i64| QuestStatusChange { id, status: "done".into(), completed_at: Some("2026-10-26T10:00:00.000Z".into()) };
        let victory = Outcome {
            quests: vec![done(stage.id), done(boss.id)],
            ritual: None,
            inventory: vec![NewInventoryItem {
                item_type: "loot".into(),
                item_name: "Трофей: Дипломная работа".into(),
                rarity: "rare".into(),
                asset_key: None,
                source_type: Some("boss".into()),
                source_id: Some(boss.id),
            }],
            remove_inventory: vec![],
            ledger: vec![],
            days: vec![],
            character: state(75, 29),
        };
        commit(&pool, victory).await?;
        let (loot_id,): (i64,) = sqlx::query_as("SELECT id FROM inventory WHERE source_type = 'boss'").fetch_one(&pool).await?;

        let active = |id: i64| QuestStatusChange { id, status: "active".into(), completed_at: None };
        let undo = Outcome {
            quests: vec![active(stage.id), active(boss.id)],
            ritual: None,
            inventory: vec![],
            remove_inventory: vec![loot_id],
            ledger: vec![],
            days: vec![],
            character: state(0, 0),
        };
        commit(&pool, undo).await?;
        let (items,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM inventory").fetch_one(&pool).await?;
        assert_eq!(items, 0);
        let all = quests::list(&pool).await?;
        assert!(all.iter().all(|q| q.status == "active"));
        Ok(())
    }

    #[tokio::test]
    async fn stage_needs_a_boss_parent() -> AppResult<()> {
        let pool = open_memory().await?;
        let side = quests::create(&pool, fields()).await?;
        let orphan = QuestFields { kind: "stage".into(), parent_id: Some(side.id), ..fields() };
        assert!(quests::create(&pool, orphan).await.is_err());
        let (count,): (i64,) = sqlx::query_as("SELECT COUNT(*) FROM locations").fetch_one(&pool).await?;
        assert_eq!(count, 5);
        Ok(())
    }
}

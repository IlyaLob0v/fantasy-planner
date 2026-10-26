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

    for id in &outcome.remove_gear {
        sqlx::query("DELETE FROM gear WHERE id = ? AND source_type IN ('quest','ritual','boss')")
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }

    for item in &outcome.gear {
        sqlx::query(
            "INSERT INTO gear (uid, item_key, source_type, source_id, game_date, misses_before) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&item.uid)
        .bind(&item.item_key)
        .bind(&item.source_type)
        .bind(item.source_id)
        .bind(&item.game_date)
        .bind(item.misses_before)
        .execute(&mut *tx)
        .await?;
    }

    for achievement in &outcome.achievements {
        sqlx::query("INSERT INTO achievements (key, uid) VALUES (?, ?)")
            .bind(&achievement.key)
            .bind(&achievement.uid)
            .execute(&mut *tx)
            .await?;
    }

    for id in &outcome.week_goals_done {
        let affected = sqlx::query(
            "UPDATE week_goals SET state = 'done', completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), \
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND state = 'active'",
        )
        .bind(id)
        .execute(&mut *tx)
        .await?
        .rows_affected();
        if affected == 0 {
            return Err(AppError::Invalid(format!("цель недели {id} уже не в работе")));
        }
    }

    for part in &outcome.crest_parts {
        sqlx::query("INSERT INTO crest_parts (key, uid) VALUES (?, ?)")
            .bind(&part.key)
            .bind(&part.uid)
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
         agility = ?, streak_current = ?, streak_best = ?, wind_step = ?, fatigued_since = ?, loot_misses = ?, \
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
    .bind(c.loot_misses)
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
    use crate::commands::{achievements, ledger, quests};
    use crate::db::open_memory;
    use crate::commands::rituals;
    use crate::models::{CharacterState, Day, NewAchievement, NewInventoryItem, NewLedgerEntry, QuestFields, QuestStatusChange, RitualFields, RitualMark};

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
            loot_misses: 0,
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
            achievements: vec![],
            gear: vec![],
            remove_gear: vec![],
            week_goals_done: vec![],
            crest_parts: vec![],
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
            achievements: vec![],
            gear: vec![],
            remove_gear: vec![],
            week_goals_done: vec![],
            crest_parts: vec![],
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
            achievements: vec![],
            gear: vec![],
            remove_gear: vec![],
            week_goals_done: vec![],
            crest_parts: vec![],
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
            achievements: vec![],
            gear: vec![],
            remove_gear: vec![],
            week_goals_done: vec![],
            crest_parts: vec![],
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
            achievements: vec![],
            gear: vec![],
            remove_gear: vec![],
            week_goals_done: vec![],
            crest_parts: vec![],
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
            achievements: vec![],
            gear: vec![],
            remove_gear: vec![],
            week_goals_done: vec![],
            crest_parts: vec![],
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

    fn gold_entry(source_type: &str, gold: i64, reverts_id: Option<i64>, note: Option<&str>) -> NewLedgerEntry {
        NewLedgerEntry {
            game_date: "2026-10-26".into(),
            source_type: source_type.into(),
            source_id: None,
            xp_delta: 0,
            gold_delta: gold,
            attribute: None,
            attribute_delta: 0,
            reverts_id,
            note: note.map(Into::into),
        }
    }

    fn empty(ledger: Vec<NewLedgerEntry>, achievements: Vec<NewAchievement>, gold: i64) -> Outcome {
        Outcome {
            quests: vec![],
            ritual: None,
            inventory: vec![],
            remove_inventory: vec![],
            ledger,
            days: vec![],
            character: state(0, gold),
            achievements,
            gear: vec![],
            remove_gear: vec![],
            week_goals_done: vec![],
            crest_parts: vec![],
        }
    }

    #[tokio::test]
    async fn achievement_is_written_once_with_its_gold() -> AppResult<()> {
        let pool = open_memory().await?;
        let first = NewAchievement { key: "first_quest".into(), uid: "0192f0a0-0000-7000-8000-000000000001".into() };
        commit(&pool, empty(vec![gold_entry("achievement", 25, None, Some("first_quest"))], vec![first.clone()], 25)).await?;
        let again = NewAchievement { uid: "0192f0a0-0000-7000-8000-000000000002".into(), ..first };
        assert!(commit(&pool, empty(vec![gold_entry("achievement", 25, None, Some("first_quest"))], vec![again], 50)).await.is_err());
        let list = achievements::list(&pool).await?;
        assert_eq!(list.iter().map(|a| a.key.as_str()).collect::<Vec<_>>(), vec!["first_quest"]);
        assert_eq!(character::fetch(&pool).await?.gold, 25);
        Ok(())
    }

    #[tokio::test]
    async fn tally_skips_reverted_entries() -> AppResult<()> {
        let pool = open_memory().await?;
        commit(&pool, empty(vec![gold_entry("quest", 3, None, None), gold_entry("quest", 3, None, None)], vec![], 6)).await?;
        let (first,): (i64,) = sqlx::query_as("SELECT MIN(id) FROM ledger").fetch_one(&pool).await?;
        commit(&pool, empty(vec![gold_entry("revert", -3, Some(first), None)], vec![], 3)).await?;
        let counts = ledger::tally(&pool).await?;
        assert_eq!(counts.len(), 1);
        assert_eq!(counts.first().map(|t| (t.source_type.as_str(), t.count)), Some(("quest", 1)));
        Ok(())
    }

    #[tokio::test]
    async fn new_hero_takes_the_oath() -> AppResult<()> {
        let pool = open_memory().await?;
        let (oath,): (String,) = sqlx::query_as("SELECT value FROM settings WHERE key = 'oath_done'").fetch_one(&pool).await?;
        assert_eq!(oath, "false");
        Ok(())
    }
}

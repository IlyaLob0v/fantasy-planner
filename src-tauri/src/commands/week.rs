use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{CrestPart, NewWeekGoal, WeekGoal};

pub async fn list_goals(pool: &SqlitePool, since: &str) -> AppResult<Vec<WeekGoal>> {
    Ok(sqlx::query_as::<_, WeekGoal>(
        "SELECT id, week_start, goal_key, target, state, completed_at FROM week_goals \
         WHERE week_start >= ? ORDER BY week_start, id",
    )
    .bind(since)
    .fetch_all(pool)
    .await?)
}

/// Записывает цели новой недели. Повторный вызов для той же недели и цели ничего не меняет.
pub async fn create_goals(pool: &SqlitePool, goals: Vec<NewWeekGoal>) -> AppResult<Vec<WeekGoal>> {
    let Some(first) = goals.first() else {
        return Ok(vec![]);
    };
    let week = first.week_start.clone();
    let mut tx = pool.begin().await?;
    for goal in &goals {
        sqlx::query("INSERT OR IGNORE INTO week_goals (uid, week_start, goal_key, target) VALUES (?, ?, ?, ?)")
            .bind(&goal.uid)
            .bind(&goal.week_start)
            .bind(&goal.goal_key)
            .bind(goal.target)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;
    list_goals(pool, &week).await
}

/// Меняет цель на другую или выключает её. Выполненная цель не меняется.
pub async fn update_goal(pool: &SqlitePool, id: i64, goal_key: &str, target: i64, state: &str) -> AppResult<WeekGoal> {
    if state == "done" {
        return Err(AppError::Invalid("цель выполняется только делами".into()));
    }
    let affected = sqlx::query(
        "UPDATE week_goals SET goal_key = ?, target = ?, state = ?, \
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND state <> 'done'",
    )
    .bind(goal_key)
    .bind(target)
    .bind(state)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::NotFound(format!("цель недели {id}")));
    }
    Ok(sqlx::query_as::<_, WeekGoal>(
        "SELECT id, week_start, goal_key, target, state, completed_at FROM week_goals WHERE id = ?",
    )
        .bind(id)
        .fetch_one(pool)
        .await?)
}

pub async fn crest_parts(pool: &SqlitePool) -> AppResult<Vec<CrestPart>> {
    Ok(sqlx::query_as::<_, CrestPart>("SELECT key, bought_at FROM crest_parts ORDER BY bought_at, key")
        .fetch_all(pool)
        .await?)
}

#[tauri::command]
pub async fn list_week_goals(db: State<'_, Db>, since: String) -> AppResult<Vec<WeekGoal>> {
    list_goals(&db.0, &since).await
}

#[tauri::command]
pub async fn create_week_goals(db: State<'_, Db>, goals: Vec<NewWeekGoal>) -> AppResult<Vec<WeekGoal>> {
    create_goals(&db.0, goals).await
}

#[tauri::command]
pub async fn update_week_goal(db: State<'_, Db>, id: i64, goal_key: String, target: i64, state: String) -> AppResult<WeekGoal> {
    update_goal(&db.0, id, &goal_key, target, &state).await
}

#[tauri::command]
pub async fn list_crest_parts(db: State<'_, Db>) -> AppResult<Vec<CrestPart>> {
    crest_parts(&db.0).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::{character, outcome};
    use crate::db::open_memory;
    use crate::models::{CharacterState, NewCrestPart, Outcome};

    fn goal(uid: &str, key: &str) -> NewWeekGoal {
        NewWeekGoal { uid: uid.into(), week_start: "2026-10-26".into(), goal_key: key.into(), target: 5 }
    }

    fn turn(week_goals_done: Vec<i64>, crest: Vec<NewCrestPart>, gold: i64) -> Outcome {
        Outcome {
            quests: vec![],
            ritual: None,
            inventory: vec![],
            remove_inventory: vec![],
            ledger: vec![],
            days: vec![],
            character: CharacterState {
                title: None,
                level: 1,
                xp: 0,
                gold,
                strength: 0,
                intellect: 0,
                agility: 0,
                streak_current: 0,
                streak_best: 0,
                wind_step: 0,
                fatigued_since: None,
                loot_misses: 0,
            },
            achievements: vec![],
            gear: vec![],
            remove_gear: vec![],
            week_goals_done,
            crest_parts: crest,
        }
    }

    #[tokio::test]
    async fn week_goals_are_created_once_and_done_once() -> AppResult<()> {
        let pool = open_memory().await?;
        let goals = create_goals(&pool, vec![goal("a", "deeds"), goal("b", "rituals")]).await?;
        assert_eq!(goals.len(), 2);
        let again = create_goals(&pool, vec![goal("c", "deeds")]).await?;
        assert_eq!(again.len(), 2);

        let swapped = update_goal(&pool, goals[1].id, "days", 4, "active").await?;
        assert_eq!((swapped.goal_key.as_str(), swapped.target), ("days", 4));

        outcome::commit(&pool, turn(vec![goals[0].id], vec![], 20)).await?;
        assert!(outcome::commit(&pool, turn(vec![goals[0].id], vec![], 40)).await.is_err());
        assert_eq!(character::fetch(&pool).await?.gold, 20);
        assert!(update_goal(&pool, goals[0].id, "main", 2, "off").await.is_err());
        let listed = list_goals(&pool, "2026-10-26").await?;
        assert_eq!(listed.iter().filter(|g| g.state == "done").count(), 1);
        Ok(())
    }

    #[tokio::test]
    async fn crest_part_is_bought_once() -> AppResult<()> {
        let pool = open_memory().await?;
        let part = || NewCrestPart { key: "charge.oak".into(), uid: "u1".into() };
        outcome::commit(&pool, turn(vec![], vec![part()], 0)).await?;
        assert!(outcome::commit(&pool, turn(vec![], vec![part()], 0)).await.is_err());
        assert_eq!(crest_parts(&pool).await?.len(), 1);
        Ok(())
    }
}

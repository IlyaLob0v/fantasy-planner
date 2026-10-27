use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::QuestStep;

/// Больше пунктов в одном квесте не бывает: крупное дело заводится боссом.
const MAX_STEPS: i64 = 10;

pub async fn list(pool: &SqlitePool) -> AppResult<Vec<QuestStep>> {
    Ok(sqlx::query_as::<_, QuestStep>(
        "SELECT s.id, s.quest_id, s.title, s.done_at, s.sort_order FROM quest_steps s \
         JOIN quests q ON q.id = s.quest_id \
         WHERE s.deleted_at IS NULL AND q.archived_at IS NULL ORDER BY s.quest_id, s.sort_order, s.id",
    )
    .fetch_all(pool)
    .await?)
}

#[tauri::command]
pub async fn list_quest_steps(db: State<'_, Db>) -> AppResult<Vec<QuestStep>> {
    list(&db.0).await
}

/// Новый пункт в конец чек-листа. Только у открытых главных и побочных квестов.
pub async fn create(pool: &SqlitePool, uid: &str, quest_id: i64, title: &str) -> AppResult<Vec<QuestStep>> {
    let title = title.trim();
    if title.is_empty() || title.chars().count() > 200 {
        return Err(AppError::Invalid("пункт: от 1 до 200 знаков".into()));
    }
    let mut tx = pool.begin().await?;
    let quest: Option<(i64,)> = sqlx::query_as(
        "SELECT id FROM quests WHERE id = ? AND type IN ('main','side') AND status = 'active' AND archived_at IS NULL",
    )
    .bind(quest_id)
    .fetch_optional(&mut *tx)
    .await?;
    if quest.is_none() {
        return Err(AppError::Invalid("чек-лист бывает у открытого главного или побочного квеста".into()));
    }
    let (count, next): (i64, i64) = sqlx::query_as(
        "SELECT COUNT(*), COALESCE(MAX(sort_order) + 1, 0) FROM quest_steps WHERE quest_id = ? AND deleted_at IS NULL",
    )
    .bind(quest_id)
    .fetch_one(&mut *tx)
    .await?;
    if count >= MAX_STEPS {
        return Err(AppError::Invalid(format!("в чек-листе не больше {MAX_STEPS} пунктов")));
    }
    sqlx::query("INSERT INTO quest_steps (uid, quest_id, title, sort_order) VALUES (?, ?, ?, ?)")
        .bind(uid)
        .bind(quest_id)
        .bind(title)
        .bind(next)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    list(pool).await
}

#[tauri::command]
pub async fn create_quest_step(db: State<'_, Db>, uid: String, quest_id: i64, title: String) -> AppResult<Vec<QuestStep>> {
    create(&db.0, &uid, quest_id, &title).await
}

/// Отметка пункта или её снятие, пока квест не выполнен.
pub async fn set_done(pool: &SqlitePool, id: i64, done: bool) -> AppResult<Vec<QuestStep>> {
    let affected = sqlx::query(
        "UPDATE quest_steps SET done_at = CASE WHEN ? THEN strftime('%Y-%m-%dT%H:%M:%fZ','now') END, \
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') \
         WHERE id = ? AND deleted_at IS NULL \
         AND quest_id IN (SELECT id FROM quests WHERE status = 'active')",
    )
    .bind(done)
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::Invalid("пункт уже не изменить: квест выполнен или пункта нет".into()));
    }
    list(pool).await
}

#[tauri::command]
pub async fn set_quest_step_done(db: State<'_, Db>, id: i64, done: bool) -> AppResult<Vec<QuestStep>> {
    set_done(&db.0, id, done).await
}

pub async fn delete(pool: &SqlitePool, id: i64) -> AppResult<Vec<QuestStep>> {
    let affected = sqlx::query(
        "UPDATE quest_steps SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), \
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND deleted_at IS NULL \
         AND quest_id IN (SELECT id FROM quests WHERE status = 'active')",
    )
    .bind(id)
    .execute(pool)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::Invalid("пункт уже не изменить: квест выполнен или пункта нет".into()));
    }
    list(pool).await
}

#[tauri::command]
pub async fn delete_quest_step(db: State<'_, Db>, id: i64) -> AppResult<Vec<QuestStep>> {
    delete(&db.0, id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::quests;
    use crate::db;
    use crate::models::QuestFields;

    fn side() -> QuestFields {
        QuestFields {
            kind: "side".into(),
            title: "Разобрать кладовую".into(),
            description: None,
            attribute: "agility".into(),
            difficulty: 1,
            scheduled_date: None,
            due_date: None,
            sort_order: 0,
            parent_id: None,
            damage: 1,
            label: Some(" Дом ".into()),
        }
    }

    #[tokio::test]
    async fn steps_are_added_ticked_and_removed() -> AppResult<()> {
        let pool = db::open_memory().await?;
        let quest = quests::create(&pool, side()).await?;
        assert_eq!(quest.label.as_deref(), Some("Дом"));
        create(&pool, "s1", quest.id, "Полки").await?;
        let steps = create(&pool, "s2", quest.id, "Ящики").await?;
        let first = steps[0].id;
        let ticked = set_done(&pool, first, true).await?;
        assert!(ticked[0].done_at.is_some());
        assert_eq!(ticked.len(), 2);
        let left = delete(&pool, first).await?;
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].sort_order, 1);
        Ok(())
    }

    #[tokio::test]
    async fn no_more_than_ten_and_only_for_tasks() -> AppResult<()> {
        let pool = db::open_memory().await?;
        let quest = quests::create(&pool, side()).await?;
        for n in 0..MAX_STEPS {
            create(&pool, &format!("s{n}"), quest.id, "пункт").await?;
        }
        assert!(create(&pool, "extra", quest.id, "пункт").await.is_err());
        let boss = quests::create(&pool, QuestFields { kind: "boss".into(), label: None, ..side() }).await?;
        assert!(create(&pool, "b", boss.id, "пункт").await.is_err());
        assert!(create(&pool, "blank", quest.id, "  ").await.is_err());
        Ok(())
    }

    #[tokio::test]
    async fn blank_label_is_refused() -> AppResult<()> {
        let pool = db::open_memory().await?;
        assert!(quests::create(&pool, QuestFields { label: Some("  ".into()), ..side() }).await.is_err());
        Ok(())
    }
}

use sqlx::SqlitePool;
use tauri::State;

use crate::db::Db;
use crate::error::{AppError, AppResult};
use crate::models::{Quest, QuestFields};

macro_rules! select_quests {
    ($tail:literal) => {
        concat!(
            "SELECT id, parent_id, type, title, description, attribute, difficulty, status, ",
            "scheduled_date, due_date, damage, sort_order, created_at, completed_at, archived_at, label ",
            "FROM quests ",
            $tail
        )
    };
}

async fn fetch(pool: &SqlitePool, id: i64) -> AppResult<Quest> {
    sqlx::query_as::<_, Quest>(select_quests!("WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("квест {id}")))
}

async fn validate(pool: &SqlitePool, fields: &QuestFields) -> AppResult<()> {
    if !matches!(fields.kind.as_str(), "main" | "side" | "boss" | "stage") {
        return Err(AppError::Invalid(format!("тип квеста {}", fields.kind)));
    }
    if fields.title.trim().is_empty() {
        return Err(AppError::Invalid("у квеста должно быть название".into()));
    }
    if fields.label.as_deref().is_some_and(|l| l.trim().is_empty() || l.chars().count() > 40) {
        return Err(AppError::Invalid("метка: от 1 до 40 знаков".into()));
    }
    if !(1..=10).contains(&fields.damage) {
        return Err(AppError::Invalid("урон этапа: от 1 до 10".into()));
    }
    match (fields.kind.as_str(), fields.parent_id) {
        ("stage", Some(parent)) => {
            let boss: Option<(i64,)> =
                sqlx::query_as("SELECT id FROM quests WHERE id = ? AND type = 'boss' AND archived_at IS NULL")
                    .bind(parent)
                    .fetch_optional(pool)
                    .await?;
            if boss.is_none() {
                return Err(AppError::Invalid("этап должен принадлежать боссу".into()));
            }
            Ok(())
        }
        ("stage", None) => Err(AppError::Invalid("этап должен принадлежать боссу".into())),
        (_, Some(_)) => Err(AppError::Invalid("родитель бывает только у этапа".into())),
        (_, None) => Ok(()),
    }
}

pub async fn list(pool: &SqlitePool) -> AppResult<Vec<Quest>> {
    Ok(sqlx::query_as::<_, Quest>(select_quests!("WHERE archived_at IS NULL ORDER BY sort_order, id"))
    .fetch_all(pool)
    .await?)
}

pub async fn create(pool: &SqlitePool, fields: QuestFields) -> AppResult<Quest> {
    validate(pool, &fields).await?;
    let id = sqlx::query(
        "INSERT INTO quests (parent_id, type, title, description, attribute, difficulty, scheduled_date, due_date, \
         damage, sort_order, label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(fields.parent_id)
    .bind(&fields.kind)
    .bind(fields.title.trim())
    .bind(&fields.description)
    .bind(&fields.attribute)
    .bind(fields.difficulty)
    .bind(&fields.scheduled_date)
    .bind(&fields.due_date)
    .bind(fields.damage)
    .bind(fields.sort_order)
    .bind(fields.label.as_deref().map(str::trim))
    .execute(pool)
    .await?
    .last_insert_rowid();
    fetch(pool, id).await
}

#[tauri::command]
pub async fn list_quests(db: State<'_, Db>) -> AppResult<Vec<Quest>> {
    list(&db.0).await
}

#[tauri::command]
pub async fn create_quest(db: State<'_, Db>, fields: QuestFields) -> AppResult<Quest> {
    create(&db.0, fields).await
}

#[tauri::command]
pub async fn update_quest(db: State<'_, Db>, id: i64, fields: QuestFields) -> AppResult<Quest> {
    validate(&db.0, &fields).await?;
    let affected = sqlx::query(
        "UPDATE quests SET type = ?, title = ?, description = ?, attribute = ?, difficulty = ?, \
         scheduled_date = ?, due_date = ?, damage = ?, sort_order = ?, label = ? \
         WHERE id = ? AND archived_at IS NULL AND parent_id IS ? \
         AND (type <> 'boss' OR ? = 'boss' OR NOT EXISTS \
              (SELECT 1 FROM quests c WHERE c.parent_id = quests.id AND c.archived_at IS NULL))",
    )
    .bind(&fields.kind)
    .bind(fields.title.trim())
    .bind(&fields.description)
    .bind(&fields.attribute)
    .bind(fields.difficulty)
    .bind(&fields.scheduled_date)
    .bind(&fields.due_date)
    .bind(fields.damage)
    .bind(fields.sort_order)
    .bind(fields.label.as_deref().map(str::trim))
    .bind(id)
    .bind(fields.parent_id)
    .bind(&fields.kind)
    .execute(&db.0)
    .await?
    .rows_affected();
    if affected == 0 {
        return Err(AppError::NotFound(format!("квест {id}")));
    }
    fetch(&db.0, id).await
}

#[tauri::command]
pub async fn archive_quest(db: State<'_, Db>, id: i64) -> AppResult<()> {
    // Этапы уходят в архив вместе с боссом.
    sqlx::query(
        "UPDATE quests SET archived_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') \
         WHERE (id = ? OR parent_id = ?) AND archived_at IS NULL",
    )
        .bind(id)
        .bind(id)
        .execute(&db.0)
        .await?;
    Ok(())
}

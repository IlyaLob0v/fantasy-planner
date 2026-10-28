use axum::Json;
use axum::extract::{Query, State};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::AppState;
use crate::auth::Session;
use crate::error::{ApiError, ApiResult};

/// Записи этой таблицы только добавляются: повтор с тем же uid ничего не меняет.
const APPEND_ONLY: &[&str] = &["ledger"];
const MAX_CHANGES: usize = 1000;
pub const PAGE: i64 = 500;

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
pub struct Change {
    pub table: String,
    pub uid: String,
    pub updated_at: String,
    pub data: Value,
}

#[derive(Deserialize)]
pub struct PushIn {
    /// Эпоха, которую знает устройство: после замены героя старые записи не принимаются.
    epoch: i64,
    changes: Vec<Change>,
}

#[derive(Serialize)]
pub struct PushOut {
    /// Сколько записей сервер принял как новые или более свежие.
    accepted: usize,
}

#[derive(Deserialize)]
pub struct PullQuery {
    #[serde(default)]
    after: i64,
}

#[derive(Serialize)]
pub struct PullOut {
    changes: Vec<Change>,
    cursor: i64,
    more: bool,
    epoch: i64,
}

#[derive(Serialize)]
pub struct InfoOut {
    epoch: i64,
    /// Сколько записей в летописи аккаунта: пустой аккаунт просто получает героя устройства.
    records: i64,
}

#[derive(Serialize)]
pub struct EpochOut {
    epoch: i64,
}

/// Блокирует строку аккаунта до конца транзакции и отдаёт его эпоху.
/// Пока идёт запись, другие отправки и замены этого аккаунта ждут: так номера seq растут в порядке фиксации.
async fn lock_account(tx: &mut sqlx::PgConnection, user_id: i64) -> ApiResult<i64> {
    let (epoch,): (i64,) = sqlx::query_as("SELECT epoch FROM users WHERE id = $1 FOR UPDATE").bind(user_id).fetch_one(tx).await?;
    Ok(epoch)
}

fn is_name(s: &str) -> bool {
    (1..=40).contains(&s.len()) && s.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
}

/// Метка правки в виде `YYYY-MM-DDTHH:MM:SS.sssZ`: такие строки сравниваются как время.
fn is_timestamp(s: &str) -> bool {
    let b = s.as_bytes();
    b.len() == 24
        && b.iter().enumerate().all(|(i, c)| match i {
            4 | 7 => *c == b'-',
            10 => *c == b'T',
            13 | 16 => *c == b':',
            19 => *c == b'.',
            23 => *c == b'Z',
            _ => c.is_ascii_digit(),
        })
}

fn validate(changes: &[Change]) -> ApiResult<()> {
    if changes.len() > MAX_CHANGES {
        return Err(ApiError::Invalid(format!("За раз не больше {MAX_CHANGES} записей")));
    }
    for c in changes {
        let uid_ok = (1..=64).contains(&c.uid.len()) && c.uid.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_');
        if !is_name(&c.table) || !uid_ok || !is_timestamp(&c.updated_at) || !c.data.is_object() {
            return Err(ApiError::Invalid(format!("Запись {}/{} не похожа на запись летописи", c.table, c.uid)));
        }
    }
    Ok(())
}

/// Принять изменения устройства. Запись побеждает, если её правка новее хранимой
/// (при равном времени решает id устройства); записи журнала только добавляются.
pub async fn push(State(state): State<AppState>, session: Session, Json(input): Json<PushIn>) -> ApiResult<Json<PushOut>> {
    validate(&input.changes)?;
    let mut tx = state.db.begin().await?;
    if lock_account(&mut tx, session.user_id).await? != input.epoch {
        return Err(ApiError::StaleEpoch);
    }
    let mut accepted = 0;
    for c in &input.changes {
        let result = sqlx::query(
            "INSERT INTO records (user_id, tbl, uid, updated_at, device_id, data)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (user_id, tbl, uid) DO UPDATE
             SET updated_at = EXCLUDED.updated_at, device_id = EXCLUDED.device_id,
                 data = EXCLUDED.data, seq = nextval('record_seq')
             WHERE NOT (records.tbl = ANY($7))
               AND (records.updated_at, records.device_id) < (EXCLUDED.updated_at, EXCLUDED.device_id)",
        )
        .bind(session.user_id)
        .bind(&c.table)
        .bind(&c.uid)
        .bind(&c.updated_at)
        .bind(&session.device_id)
        .bind(&c.data)
        .bind(APPEND_ONLY)
        .execute(&mut *tx)
        .await?;
        accepted += usize::try_from(result.rows_affected()).unwrap_or(0);
    }
    tx.commit().await?;
    Ok(Json(PushOut { accepted }))
}

/// Отдать записи аккаунта после курсора. Свои записи устройство не получает,
/// но курсор сдвигается и за них, чтобы не перечитывать их снова.
pub async fn pull(State(state): State<AppState>, session: Session, Query(q): Query<PullQuery>) -> ApiResult<Json<PullOut>> {
    let (epoch,): (i64,) = sqlx::query_as("SELECT epoch FROM users WHERE id = $1").bind(session.user_id).fetch_one(&state.db).await?;
    let rows: Vec<(String, String, String, String, Value, i64)> = sqlx::query_as(
        "SELECT tbl, uid, updated_at, device_id, data, seq FROM records
         WHERE user_id = $1 AND seq > $2 ORDER BY seq LIMIT $3",
    )
    .bind(session.user_id)
    .bind(q.after)
    .bind(PAGE)
    .fetch_all(&state.db)
    .await?;
    let more = i64::try_from(rows.len()).unwrap_or(PAGE) >= PAGE;
    let cursor = rows.last().map_or(q.after, |r| r.5);
    let changes = rows
        .into_iter()
        .filter(|r| r.3 != session.device_id)
        .map(|(table, uid, updated_at, _, data, _)| Change { table, uid, updated_at, data })
        .collect();
    Ok(Json(PullOut { changes, cursor, more, epoch }))
}

/// Эпоха и размер летописи аккаунта: по ним устройство решает, что делать при первом входе.
pub async fn info(State(state): State<AppState>, session: Session) -> ApiResult<Json<InfoOut>> {
    let (epoch, records): (i64, i64) =
        sqlx::query_as("SELECT epoch, (SELECT count(*) FROM records WHERE user_id = $1) FROM users WHERE id = $1")
            .bind(session.user_id)
            .fetch_one(&state.db)
            .await?;
    Ok(Json(InfoOut { epoch, records }))
}

/// Замена героя: летопись аккаунта уходит в архив на 30 дней, эпоха растёт.
/// После этого устройство отправляет свою летопись целиком, а остальные принимают её заново.
pub async fn replace(State(state): State<AppState>, session: Session) -> ApiResult<Json<EpochOut>> {
    let mut tx = state.db.begin().await?;
    let epoch = lock_account(&mut tx, session.user_id).await?;
    sqlx::query(
        "INSERT INTO records_archive (user_id, epoch, tbl, uid, updated_at, device_id, data)
         SELECT user_id, $2, tbl, uid, updated_at, device_id, data FROM records WHERE user_id = $1",
    )
    .bind(session.user_id)
    .bind(epoch)
    .execute(&mut *tx)
    .await?;
    sqlx::query("DELETE FROM records WHERE user_id = $1").bind(session.user_id).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM records_archive WHERE user_id = $1 AND archived_at < now() - interval '30 days'")
        .bind(session.user_id)
        .execute(&mut *tx)
        .await?;
    let (epoch,): (i64,) = sqlx::query_as("UPDATE users SET epoch = epoch + 1 WHERE id = $1 RETURNING epoch")
        .bind(session.user_id)
        .fetch_one(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(EpochOut { epoch }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamps_must_be_iso_with_millis() {
        assert!(is_timestamp("2026-10-27T03:15:42.123Z"));
        assert!(!is_timestamp("2026-10-27T03:15:42Z"));
        assert!(!is_timestamp("2026-10-27 03:15:42.123Z"));
    }

    #[test]
    fn table_names_are_plain() {
        assert!(is_name("ritual_completions"));
        assert!(!is_name("Quests"));
        assert!(!is_name("quests; drop"));
        assert!(!is_name(""));
    }
}

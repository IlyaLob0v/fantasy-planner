//! «Гильдейская почта»: сверка летописи с сервером гильдии (specs/sync.md).
//! Отправка изменённого, приём чужого, первое подключение и смена эпохи. Пересчёт героя делает TS.

mod client;
pub mod records;

use std::path::{Path, PathBuf};

use serde::Serialize;
use sqlx::{SqliteConnection, SqlitePool};
use tauri::{AppHandle, Manager, State};

use crate::db::Db;
use crate::error::{AppError, AppResult};
use client::{Client, Refusal};
use records::Change;

/// Сверки идут по одной: кнопка, таймер и возврат из фона не мешают друг другу.
#[derive(Default)]
pub struct SyncGate(tokio::sync::Mutex<()>);

/// Записей за одну отправку: держит тело запроса меньше мегабайта даже с длинной хроникой.
const PUSH_BATCH: usize = 200;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncStatus {
    pub server: Option<String>,
    pub email: Option<String>,
    pub device_name: Option<String>,
    pub signed_in: bool,
    /// Герой выбран и устройство сверяется. Вошёл, но ещё не выбрал: false.
    pub linked: bool,
    pub last_sync_at: Option<String>,
    /// Сколько правок ждут отправки.
    pub pending: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignIn {
    pub remote_records: i64,
    pub local_progress: bool,
}

#[derive(Serialize, Default, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SyncReport {
    pub pushed: usize,
    pub applied: usize,
    /// Героя аккаунта заменили с другого устройства: местная летопись ушла в резервную копию.
    pub reset: bool,
}

async fn get(conn: &mut SqliteConnection, key: &str) -> AppResult<Option<String>> {
    Ok(sqlx::query_scalar("SELECT value FROM sync_state WHERE key = ?").bind(key).fetch_optional(&mut *conn).await?)
}

async fn set(conn: &mut SqliteConnection, key: &str, value: &str) -> AppResult<()> {
    sqlx::query("INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
        .bind(key)
        .bind(value)
        .execute(&mut *conn)
        .await?;
    Ok(())
}

async fn forget(conn: &mut SqliteConnection, keys: &[&str]) -> AppResult<()> {
    for key in keys {
        sqlx::query("DELETE FROM sync_state WHERE key = ?").bind(key).execute(&mut *conn).await?;
    }
    Ok(())
}

fn number(raw: Option<String>) -> Option<i64> {
    raw.and_then(|v| v.parse().ok())
}

async fn signed_client(pool: &SqlitePool) -> AppResult<Client> {
    let mut conn = pool.acquire().await?;
    let server = get(&mut conn, "server").await?;
    let token = get(&mut conn, "token").await?;
    match (server, token) {
        (Some(server), Some(token)) => Client::new(&server, Some(token)),
        _ => Err(AppError::SignedOut),
    }
}

/// Токен больше не действует: устройство выходит из почты, летопись и курсор остаются.
async fn on_signed_out<T>(pool: &SqlitePool, result: AppResult<T>) -> AppResult<T> {
    if matches!(result, Err(AppError::SignedOut)) {
        let mut conn = pool.acquire().await?;
        forget(&mut conn, &["token", "device_id", "epoch", "cursor"]).await?;
    }
    result
}

pub async fn status(pool: &SqlitePool) -> AppResult<SyncStatus> {
    let mut conn = pool.acquire().await?;
    let pending: i64 = sqlx::query_scalar("SELECT count(*) FROM sync_outbox").fetch_one(&mut *conn).await?;
    Ok(SyncStatus {
        server: get(&mut conn, "server").await?,
        email: get(&mut conn, "email").await?,
        device_name: get(&mut conn, "device_name").await?,
        signed_in: get(&mut conn, "token").await?.is_some(),
        linked: get(&mut conn, "epoch").await?.is_some(),
        last_sync_at: get(&mut conn, "last_sync_at").await?,
        pending,
    })
}

async fn local_progress(pool: &SqlitePool) -> AppResult<bool> {
    Ok(sqlx::query_scalar("SELECT EXISTS (SELECT 1 FROM ledger)").fetch_one(pool).await?)
}

/// Копия базы рядом с ней, прежде чем местная летопись уступит героя из аккаунта.
async fn backup(pool: &SqlitePool, dir: &Path) -> AppResult<PathBuf> {
    let stamp: String = sqlx::query_scalar("SELECT strftime('%Y%m%d-%H%M%S', 'now')").fetch_one(pool).await?;
    let path = dir.join(format!("guild-backup-{stamp}.db"));
    sqlx::query("VACUUM INTO ?").bind(path.to_string_lossy().into_owned()).execute(pool).await?;
    Ok(path)
}

/// Местная летопись очищается, курсор с начала: следующая сверка принесёт героя из аккаунта.
async fn take_remote(pool: &SqlitePool, backups: &Path, epoch: i64) -> AppResult<()> {
    if local_progress(pool).await? {
        backup(pool, backups).await?;
    }
    let mut tx = pool.begin().await?;
    records::set_applying(&mut tx, true).await?;
    records::wipe(&mut tx).await?;
    records::set_applying(&mut tx, false).await?;
    set(&mut tx, "epoch", &epoch.to_string()).await?;
    set(&mut tx, "cursor", "0").await?;
    tx.commit().await?;
    Ok(())
}

enum Attempt {
    Done { pushed: usize, applied: usize },
    /// Эпоха аккаунта сменилась; известна новая, если её сообщил приём.
    Stale(Option<i64>),
}

async fn push_all(pool: &SqlitePool, client: &Client, epoch: i64) -> AppResult<Result<usize, ()>> {
    let rows: Vec<(String, String, String)> = sqlx::query_as("SELECT tbl, key, changed_at FROM sync_outbox").fetch_all(pool).await?;
    let mut changes: Vec<Change> = Vec::with_capacity(rows.len());
    {
        let mut conn = pool.acquire().await?;
        for (table, key, changed_at) in &rows {
            match records::collect(&mut conn, table, key, changed_at).await? {
                Some(change) => changes.push(change),
                None => {
                    sqlx::query("DELETE FROM sync_outbox WHERE tbl = ? AND key = ?").bind(table).bind(key).execute(&mut *conn).await?;
                }
            }
        }
    }
    changes.sort_by(|a, b| records::rank(&a.table).cmp(&records::rank(&b.table)).then_with(|| a.updated_at.cmp(&b.updated_at)));
    let mut pushed = 0;
    for batch in changes.chunks(PUSH_BATCH) {
        match client.push(epoch, batch).await {
            Ok(()) => {}
            Err(Refusal::StaleEpoch) => return Ok(Err(())),
            Err(Refusal::Other(e)) => return Err(e),
        }
        let mut tx = pool.begin().await?;
        for c in batch {
            sqlx::query("DELETE FROM sync_outbox WHERE tbl = ? AND key = ? AND changed_at = ?")
                .bind(&c.table)
                .bind(&c.uid)
                .bind(&c.updated_at)
                .execute(&mut *tx)
                .await?;
        }
        tx.commit().await?;
        pushed += batch.len();
    }
    Ok(Ok(pushed))
}

/// Записывает страницу принятого одной транзакцией вместе с курсором.
pub async fn receive(pool: &SqlitePool, changes: &[Change], cursor: i64) -> AppResult<usize> {
    let mut tx = pool.begin().await?;
    records::set_applying(&mut tx, true).await?;
    let mut applied = 0;
    for change in changes {
        if records::apply(&mut tx, change).await? == records::Applied::Written {
            applied += 1;
        }
    }
    applied += records::retry_inbox(&mut tx).await?;
    records::set_applying(&mut tx, false).await?;
    set(&mut tx, "cursor", &cursor.to_string()).await?;
    tx.commit().await?;
    Ok(applied)
}

async fn attempt(pool: &SqlitePool, client: &Client, epoch: i64) -> AppResult<Attempt> {
    let Ok(pushed) = push_all(pool, client, epoch).await? else {
        return Ok(Attempt::Stale(None));
    };
    let mut applied = 0;
    loop {
        let cursor = {
            let mut conn = pool.acquire().await?;
            number(get(&mut conn, "cursor").await?).unwrap_or(0)
        };
        let page = client.pull(cursor).await?;
        if page.epoch != epoch {
            return Ok(Attempt::Stale(Some(page.epoch)));
        }
        applied += receive(pool, &page.changes, page.cursor).await?;
        if !page.more {
            return Ok(Attempt::Done { pushed, applied });
        }
    }
}

pub async fn run(pool: &SqlitePool, backups: &Path) -> AppResult<SyncReport> {
    let client = signed_client(pool).await?;
    let mut report = SyncReport::default();
    loop {
        let epoch = {
            let mut conn = pool.acquire().await?;
            number(get(&mut conn, "epoch").await?).ok_or_else(|| AppError::Sync("Сначала выбери, какого героя оставить".into()))?
        };
        match attempt(pool, &client, epoch).await? {
            Attempt::Done { pushed, applied } => {
                report.pushed += pushed;
                report.applied += applied;
                break;
            }
            Attempt::Stale(known) => {
                let fresh = match known {
                    Some(e) => e,
                    None => client.info().await?.epoch,
                };
                take_remote(pool, backups, fresh).await?;
                report.reset = true;
            }
        }
    }
    let mut conn = pool.acquire().await?;
    let now: String = sqlx::query_scalar("SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now')").fetch_one(&mut *conn).await?;
    set(&mut conn, "last_sync_at", &now).await?;
    Ok(report)
}

fn backups_dir(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?)
}

#[tauri::command]
pub async fn sync_status(db: State<'_, Db>) -> AppResult<SyncStatus> {
    status(&db.0).await
}

/// Вход или новый аккаунт. Героя устройство ещё не выбрало: до `link` сверки нет.
pub async fn sign_in(pool: &SqlitePool, server: &str, email: &str, password: &str, device_name: &str, create: bool) -> AppResult<SignIn> {
    let address = client::normalize_server(server)?;
    let session = Client::new(&address, None)?.sign_in(create, email, password, device_name).await?;
    let info = Client::new(&address, Some(session.token.clone()))?.info().await?;
    let mut tx = pool.begin().await?;
    forget(&mut tx, &["epoch", "cursor"]).await?;
    set(&mut tx, "server", &address).await?;
    set(&mut tx, "email", email.trim()).await?;
    set(&mut tx, "device_name", device_name.trim()).await?;
    set(&mut tx, "token", &session.token).await?;
    set(&mut tx, "device_id", &session.device_id).await?;
    tx.commit().await?;
    Ok(SignIn { remote_records: info.records, local_progress: local_progress(pool).await? })
}

/// Выбор героя при первом подключении: `remote` берёт героя из аккаунта, `local` отправляет героя устройства.
pub async fn link(pool: &SqlitePool, backups: &Path, keep: &str) -> AppResult<SyncReport> {
    let client = signed_client(pool).await?;
    let info = client.info().await?;
    match keep {
        "remote" => take_remote(pool, backups, info.epoch).await?,
        "local" => {
            let epoch = if info.records > 0 { client.replace().await?.epoch } else { info.epoch };
            let mut tx = pool.begin().await?;
            records::mark_all(&mut tx).await?;
            set(&mut tx, "epoch", &epoch.to_string()).await?;
            set(&mut tx, "cursor", "0").await?;
            tx.commit().await?;
        }
        other => return Err(AppError::Invalid(format!("неизвестный выбор героя: {other}"))),
    }
    run(pool, backups).await
}

#[tauri::command]
pub async fn sync_sign_in(
    db: State<'_, Db>,
    gate: State<'_, SyncGate>,
    server: String,
    email: String,
    password: String,
    device_name: String,
    create: bool,
) -> AppResult<SignIn> {
    let _turn = gate.0.lock().await;
    sign_in(&db.0, &server, &email, &password, &device_name, create).await
}

#[tauri::command]
pub async fn sync_link(app: AppHandle, db: State<'_, Db>, gate: State<'_, SyncGate>, keep: String) -> AppResult<SyncReport> {
    let _turn = gate.0.lock().await;
    let result = link(&db.0, &backups_dir(&app)?, &keep).await;
    on_signed_out(&db.0, result).await
}

#[tauri::command]
pub async fn sync_now(app: AppHandle, db: State<'_, Db>, gate: State<'_, SyncGate>) -> AppResult<SyncReport> {
    let _turn = gate.0.lock().await;
    let backups = backups_dir(&app)?;
    let result = run(&db.0, &backups).await;
    on_signed_out(&db.0, result).await
}

/// Смена пароля. Остальные устройства выходят из почты и входят уже с новым паролем.
#[tauri::command]
pub async fn sync_change_password(db: State<'_, Db>, gate: State<'_, SyncGate>, password: String, new_password: String) -> AppResult<()> {
    let _turn = gate.0.lock().await;
    let result = match signed_client(&db.0).await {
        Ok(client) => client.change_password(&password, &new_password).await,
        Err(e) => Err(e),
    };
    on_signed_out(&db.0, result).await
}

/// Выход из почты. Адрес, e-mail и имя устройства остаются, чтобы войти снова было быстро.
#[tauri::command]
pub async fn sync_sign_out(db: State<'_, Db>, gate: State<'_, SyncGate>) -> AppResult<()> {
    let _turn = gate.0.lock().await;
    let pool = &db.0;
    if let Ok(client) = signed_client(pool).await {
        // Сервер может быть недоступен: выход на устройстве от этого не зависит.
        let _ = client.sign_out().await;
    }
    let mut conn = pool.acquire().await?;
    forget(&mut conn, &["token", "device_id", "epoch", "cursor"]).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    /// Принятая страница двигает курсор; замена героя очищает летопись и оставляет копию базы.
    #[tokio::test]
    async fn receive_moves_cursor_and_take_remote_backs_up() -> AppResult<()> {
        let dir = std::env::temp_dir().join(format!("guild-sync-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let pool = db::open(&dir.join("guild.db")).await?;
        // Миграции после 0007 сеют настройки уже под триггерами: свежая база не начинает с пустого журнала исходящих.
        sqlx::query("DELETE FROM sync_outbox").execute(&pool).await?;
        let quest = Change {
            table: "quests".into(),
            uid: "q1".into(),
            updated_at: "2026-10-27T10:00:00.000Z".into(),
            data: serde_json::json!({ "parent": null, "type": "side", "title": "Отчёт", "description": null, "attribute": "intellect",
                "difficulty": 1, "status": "active", "scheduled_date": null, "due_date": null, "damage": 1, "sort_order": 0,
                "created_at": "2026-10-27T10:00:00.000Z", "completed_at": null, "archived_at": null }),
        };
        assert_eq!(receive(&pool, &[quest], 42).await?, 1);
        let s = status(&pool).await?;
        assert_eq!((s.pending, s.linked, s.signed_in), (0, false, false));
        let mut conn = pool.acquire().await?;
        assert_eq!(number(get(&mut conn, "cursor").await?), Some(42));
        drop(conn);

        sqlx::query("INSERT INTO ledger (game_date, source_type, gold_delta) VALUES ('2026-10-27', 'quest', 3)").execute(&pool).await?;
        take_remote(&pool, &dir, 3).await?;
        let copies = std::fs::read_dir(&dir)?.filter_map(Result::ok).filter(|e| e.file_name().to_string_lossy().starts_with("guild-backup-")).count();
        assert_eq!(copies, 1);
        let (quests, ledger): (i64, i64) =
            sqlx::query_as("SELECT (SELECT count(*) FROM quests), (SELECT count(*) FROM ledger)").fetch_one(&pool).await?;
        assert_eq!((quests, ledger), (0, 0));
        assert!(status(&pool).await?.linked);
        // На Windows открытую базу не удалить: сначала закрыть пул.
        pool.close().await;
        std::fs::remove_dir_all(&dir)?;
        Ok(())
    }
}

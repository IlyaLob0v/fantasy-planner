//! Записи летописи для сервера: сбор по ключу, применение принятого, перевод связей `id` ↔ ключ.
//! Какие таблицы и как сливаются, описано в specs/sync.md, раздел 1. Правил игры здесь нет.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
// Запросы собираются только из имён таблиц и столбцов SPECS; значения всегда идут параметрами.
use sqlx::{AssertSqlSafe, SqliteConnection};

use crate::error::{AppError, AppResult};

/// Запись в пакете синхронизации, как её хранит сервер.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct Change {
    pub table: String,
    pub uid: String,
    pub updated_at: String,
    pub data: Value,
}

#[derive(Debug, PartialEq, Eq)]
pub enum Applied {
    Written,
    /// Местная правка новее, или запись уже есть (журнал только добавляется).
    Skipped,
    /// Связь ещё не пришла: запись ждёт в sync_inbox.
    Deferred,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Merge {
    /// Последняя правка побеждает.
    Latest,
    /// Запись не меняется после появления.
    AppendOnly,
}

#[derive(Clone, Copy)]
enum Col {
    Plain(&'static str),
    /// Значение уже JSON (настройки): пересылается как есть, а не строкой.
    Json(&'static str),
}

impl Col {
    fn name(self) -> &'static str {
        match self {
            Col::Plain(n) | Col::Json(n) => n,
        }
    }
}

struct Spec {
    table: &'static str,
    /// Выражение ключа записи в строке таблицы.
    key: &'static str,
    /// Столбец, куда при вставке ложится сам ключ; у составного ключа его нет.
    key_column: Option<&'static str>,
    /// Цель ON CONFLICT при записи принятого.
    conflict: &'static str,
    cols: &'static [Col],
    merge: Merge,
    /// Строки, которые не уходят с устройства.
    local_only: Option<&'static str>,
}

use Col::{Json, Plain};

const SPECS: &[Spec] = &[
    Spec {
        table: "rest_actions",
        key: "uid",
        key_column: Some("uid"),
        conflict: "uid",
        cols: &[Plain("title"), Plain("archived_at")],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "rituals",
        key: "uid",
        key_column: Some("uid"),
        conflict: "uid",
        cols: &[
            Plain("title"),
            Plain("real_name"),
            Plain("attribute"),
            Plain("schedule"),
            Plain("weekdays_mask"),
            Plain("times_per_week"),
            Plain("interval_days"),
            Plain("start_date"),
            Plain("paused_until"),
            Plain("difficulty"),
            Plain("sort_order"),
            Plain("created_at"),
            Plain("archived_at"),
        ],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "rewards",
        key: "uid",
        key_column: Some("uid"),
        conflict: "uid",
        cols: &[
            Plain("title"),
            Plain("description"),
            Plain("price"),
            Plain("repeatable"),
            Plain("asset_key"),
            Plain("created_at"),
            Plain("archived_at"),
        ],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "quests",
        key: "uid",
        key_column: Some("uid"),
        conflict: "uid",
        cols: &[
            Plain("parent_id"),
            Plain("type"),
            Plain("title"),
            Plain("description"),
            Plain("attribute"),
            Plain("difficulty"),
            Plain("status"),
            Plain("scheduled_date"),
            Plain("due_date"),
            Plain("damage"),
            Plain("sort_order"),
            Plain("created_at"),
            Plain("completed_at"),
            Plain("archived_at"),
        ],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "week_goals",
        key: "week_start",
        key_column: None,
        conflict: "",
        cols: &[],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "ledger",
        key: "uid",
        key_column: Some("uid"),
        conflict: "uid",
        cols: &[
            Plain("occurred_at"),
            Plain("game_date"),
            Plain("source_type"),
            Plain("source_id"),
            Plain("xp_delta"),
            Plain("gold_delta"),
            Plain("attribute"),
            Plain("attribute_delta"),
            Plain("reverts_id"),
            Plain("note"),
        ],
        merge: Merge::AppendOnly,
        local_only: None,
    },
    Spec {
        table: "inventory",
        key: "uid",
        key_column: Some("uid"),
        conflict: "uid",
        cols: &[
            Plain("item_type"),
            Plain("item_name"),
            Plain("rarity"),
            Plain("asset_key"),
            Plain("source_type"),
            Plain("source_id"),
            Plain("obtained_at"),
            Plain("redeemed_at"),
        ],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "ritual_completions",
        key: "(SELECT uid FROM rituals WHERE rituals.id = ritual_id) || '_' || game_date",
        key_column: None,
        conflict: "ritual_id, game_date",
        cols: &[Plain("ritual_id"), Plain("game_date"), Plain("completed_at")],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "gear",
        key: "item_key",
        key_column: Some("item_key"),
        conflict: "item_key",
        cols: &[
            Plain("uid"),
            Plain("source_type"),
            Plain("source_id"),
            Plain("game_date"),
            Plain("misses_before"),
            Plain("obtained_at"),
        ],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "equipment",
        key: "slot",
        key_column: Some("slot"),
        conflict: "slot",
        cols: &[Plain("gear_id")],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "achievements",
        key: "key",
        key_column: Some("key"),
        conflict: "key",
        cols: &[Plain("uid"), Plain("unlocked_at")],
        merge: Merge::AppendOnly,
        local_only: None,
    },
    Spec {
        table: "crest_parts",
        key: "key",
        key_column: Some("key"),
        conflict: "key",
        cols: &[Plain("uid"), Plain("bought_at")],
        merge: Merge::AppendOnly,
        local_only: None,
    },
    Spec {
        table: "saga_chapters",
        key: "key",
        key_column: Some("key"),
        conflict: "key",
        cols: &[Plain("uid"), Plain("unlocked_at"), Plain("read_at"), Plain("updated_at")],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "inn_stays",
        key: "uid",
        key_column: Some("uid"),
        conflict: "uid",
        cols: &[Plain("start_date"), Plain("end_date"), Plain("created_at"), Plain("updated_at"), Plain("deleted_at")],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "chronicle",
        key: "game_date",
        key_column: Some("game_date"),
        conflict: "game_date",
        cols: &[Plain("happened"), Plain("noticed"), Plain("feeling"), Plain("mood"), Plain("updated_at")],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "days",
        key: "game_date",
        key_column: Some("game_date"),
        conflict: "game_date",
        cols: &[Plain("kind")],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "character",
        key: "'hero'",
        key_column: None,
        conflict: "",
        cols: &[Plain("name"), Plain("location_key")],
        merge: Merge::Latest,
        local_only: None,
    },
    Spec {
        table: "settings",
        key: "key",
        key_column: Some("key"),
        conflict: "key",
        cols: &[Json("value")],
        merge: Merge::Latest,
        local_only: Some("key IN ('motion', 'sound_enabled', 'reminder')"),
    },
];

fn spec(table: &str) -> Option<&'static Spec> {
    SPECS.iter().find(|s| s.table == table)
}

/// Порядок отправки: сначала то, на что ссылаются (квесты раньше журнала). Связи, пришедшие раньше цели, всё равно дождутся её в sync_inbox.
pub fn rank(table: &str) -> usize {
    SPECS.iter().position(|s| s.table == table).unwrap_or(SPECS.len())
}

/// Куда указывает связь: таблица и как в ней ключ переводится в местный id и обратно.
#[derive(Clone, Copy, Debug)]
enum Target {
    Quests,
    Rituals,
    RestActions,
    Rewards,
    Ledger,
    Gear,
    WeekGoal,
}

impl Target {
    fn key_of_id(self) -> &'static str {
        match self {
            Target::Quests => "SELECT uid FROM quests WHERE id = ?",
            Target::Rituals => "SELECT uid FROM rituals WHERE id = ?",
            Target::RestActions => "SELECT uid FROM rest_actions WHERE id = ?",
            Target::Rewards => "SELECT uid FROM rewards WHERE id = ?",
            Target::Ledger => "SELECT uid FROM ledger WHERE id = ?",
            Target::Gear => "SELECT item_key FROM gear WHERE id = ?",
            Target::WeekGoal => "SELECT week_start || '_' || goal_key FROM week_goals WHERE id = ?",
        }
    }

    fn id_of_key(self) -> &'static str {
        match self {
            Target::Quests => "SELECT id FROM quests WHERE uid = ?",
            Target::Rituals => "SELECT id FROM rituals WHERE uid = ?",
            Target::RestActions => "SELECT id FROM rest_actions WHERE uid = ?",
            Target::Rewards => "SELECT id FROM rewards WHERE uid = ?",
            Target::Ledger => "SELECT id FROM ledger WHERE uid = ?",
            Target::Gear => "SELECT id FROM gear WHERE item_key = ?",
            Target::WeekGoal => "SELECT id FROM week_goals WHERE week_start || '_' || goal_key = ?",
        }
    }
}

/// Связь записи: местное поле с id и поле пакета с ключом.
struct Ref {
    local: &'static str,
    wire: &'static str,
    target: Target,
    /// Без цели запись нельзя записать: она ждёт в sync_inbox. Иначе связь просто обнуляется.
    required: bool,
}

fn text<'a>(data: &'a Map<String, Value>, field: &str) -> &'a str {
    data.get(field).and_then(Value::as_str).unwrap_or("")
}

/// Куда указывает `source_id` журнала: зависит от источника, у отмены от источника отменённого (в `note`).
fn ledger_source(source_type: &str, note: &str) -> Option<(Target, bool)> {
    match (source_type, note) {
        ("quest" | "boss_defeat", _) | ("revert", "quest" | "boss_defeat") => Some((Target::Quests, true)),
        ("ritual", _) | ("revert", "ritual") => Some((Target::Rituals, true)),
        ("rest_action", _) => Some((Target::RestActions, true)),
        ("purchase", _) => Some((Target::Rewards, true)),
        ("week_chest", _) => Some((Target::WeekGoal, false)),
        _ => None,
    }
}

fn refs(table: &str, data: &Map<String, Value>) -> Vec<Ref> {
    let source = |target: Option<(Target, bool)>| {
        target.map(|(target, required)| Ref { local: "source_id", wire: "source", target, required })
    };
    match table {
        "quests" => vec![Ref { local: "parent_id", wire: "parent", target: Target::Quests, required: true }],
        "ledger" => {
            let mut list: Vec<Ref> = source(ledger_source(text(data, "source_type"), text(data, "note"))).into_iter().collect();
            list.push(Ref { local: "reverts_id", wire: "reverts", target: Target::Ledger, required: true });
            list
        }
        "inventory" => source(match text(data, "source_type") {
            "boss" => Some((Target::Quests, true)),
            "purchase" => Some((Target::Rewards, true)),
            _ => None,
        })
        .into_iter()
        .collect(),
        "gear" => source(match text(data, "source_type") {
            "quest" | "boss" => Some((Target::Quests, true)),
            "ritual" => Some((Target::Rituals, true)),
            _ => None,
        })
        .into_iter()
        .collect(),
        "ritual_completions" => vec![Ref { local: "ritual_id", wire: "ritual", target: Target::Rituals, required: true }],
        "equipment" => vec![Ref { local: "gear_id", wire: "gear", target: Target::Gear, required: true }],
        _ => vec![],
    }
}

/// Поля, чьё значение — id, а не ключ: у источников без цели (`rest`, `achievement`) id пересылать некуда.
fn local_ids(table: &str) -> &'static [&'static str] {
    match table {
        "ledger" | "inventory" | "gear" => &["source_id"],
        _ => &[],
    }
}

fn read_sql(s: &Spec) -> String {
    match s.table {
        "week_goals" => "SELECT json_object('goals', json_group_array(json_object('uid', uid, 'goal_key', goal_key, \
                         'target', target, 'state', state, 'completed_at', completed_at))) \
                         FROM week_goals WHERE week_start = ?1 HAVING count(*) > 0"
            .into(),
        "character" => "SELECT json_object('name', name, 'location_key', location_key) FROM character WHERE id = 1".into(),
        _ => {
            let fields: Vec<String> = s
                .cols
                .iter()
                .map(|c| match c {
                    Plain(n) => format!("'{n}', {n}"),
                    Json(n) => format!("'{n}', json({n})"),
                })
                .collect();
            format!("SELECT json_object({}) FROM {} WHERE {} = ?1", fields.join(", "), s.table, s.key)
        }
    }
}

fn write_sql(s: &Spec) -> Vec<String> {
    match s.table {
        // Цели, которые есть в обоих наборах, сохраняют местный id: на него ссылается золото за цель в журнале.
        "week_goals" => vec![
            "DELETE FROM week_goals WHERE week_start = ?1 AND goal_key NOT IN \
             (SELECT json_extract(value, '$.goal_key') FROM json_each(?2, '$.goals'))"
                .into(),
            "INSERT INTO week_goals (uid, week_start, goal_key, target, state, completed_at) \
             SELECT json_extract(value, '$.uid'), ?1, json_extract(value, '$.goal_key'), json_extract(value, '$.target'), \
             json_extract(value, '$.state'), json_extract(value, '$.completed_at') FROM json_each(?2, '$.goals') WHERE true \
             ON CONFLICT (week_start, goal_key) DO UPDATE SET target = excluded.target, state = excluded.state, \
             completed_at = excluded.completed_at"
                .into(),
        ],
        "character" => vec!["UPDATE character SET name = json_extract(?2, '$.name'), \
                             location_key = json_extract(?2, '$.location_key') WHERE id = 1"
            .into()],
        _ => {
            let value = |c: &Col| match c {
                Plain(n) => format!("json_extract(?2, '$.{n}')"),
                Json(n) => format!("?2 -> '$.{n}'"),
            };
            let mut columns: Vec<&str> = s.key_column.into_iter().collect();
            let mut values: Vec<String> = s.key_column.map(|_| "?1".to_owned()).into_iter().collect();
            columns.extend(s.cols.iter().map(|c| c.name()));
            values.extend(s.cols.iter().map(value));
            let on_conflict = match s.merge {
                Merge::AppendOnly => "DO NOTHING".to_owned(),
                Merge::Latest => {
                    let set: Vec<String> = s.cols.iter().map(|c| format!("{0} = excluded.{0}", c.name())).collect();
                    format!("({}) DO UPDATE SET {}", s.conflict, set.join(", "))
                }
            };
            vec![format!(
                "INSERT INTO {} ({}) VALUES ({}) ON CONFLICT {on_conflict}",
                s.table,
                columns.join(", "),
                values.join(", ")
            )]
        }
    }
}

fn delete_sql(s: &Spec) -> Option<String> {
    match s.table {
        "inventory" | "ritual_completions" | "gear" | "week_goals" => Some(format!("DELETE FROM {} WHERE {} = ?1", s.table, s.key)),
        _ => None,
    }
}

async fn lookup_text(conn: &mut SqliteConnection, sql: &'static str, id: i64) -> AppResult<Option<String>> {
    Ok(sqlx::query_scalar::<_, Option<String>>(sql).bind(id).fetch_optional(&mut *conn).await?.flatten())
}

async fn lookup_id(conn: &mut SqliteConnection, sql: &'static str, key: &str) -> AppResult<Option<i64>> {
    Ok(sqlx::query_scalar::<_, i64>(sql).bind(key).fetch_optional(&mut *conn).await?)
}

fn object(value: Value) -> AppResult<Map<String, Value>> {
    match value {
        Value::Object(map) => Ok(map),
        _ => Err(AppError::Invalid("запись летописи должна быть объектом".into())),
    }
}

/// Текущее состояние записи для отправки. Строки нет: отметка удаления.
pub async fn collect(conn: &mut SqliteConnection, table: &str, key: &str, changed_at: &str) -> AppResult<Option<Change>> {
    let Some(s) = spec(table) else {
        return Ok(None);
    };
    let row: Option<Option<String>> = sqlx::query_scalar(AssertSqlSafe(read_sql(s))).bind(key).fetch_optional(&mut *conn).await?;
    let data = match row.flatten() {
        None => serde_json::json!({ "_deleted": true }),
        Some(raw) => {
            let mut data = object(serde_json::from_str(&raw).map_err(|e| AppError::Invalid(e.to_string()))?)?;
            for r in refs(table, &data) {
                let id = data.remove(r.local).and_then(|v| v.as_i64());
                let target = match id {
                    Some(id) => lookup_text(conn, r.target.key_of_id(), id).await?,
                    None => None,
                };
                data.insert(r.wire.into(), target.map_or(Value::Null, Value::String));
            }
            for field in local_ids(table) {
                data.remove(*field);
            }
            Value::Object(data)
        }
    };
    Ok(Some(Change { table: table.into(), uid: key.into(), updated_at: changed_at.into(), data }))
}

async fn defer(conn: &mut SqliteConnection, change: &Change) -> AppResult<Applied> {
    sqlx::query("INSERT OR REPLACE INTO sync_inbox (tbl, key, updated_at, data) VALUES (?, ?, ?, ?)")
        .bind(&change.table)
        .bind(&change.uid)
        .bind(&change.updated_at)
        .bind(change.data.to_string())
        .execute(&mut *conn)
        .await?;
    Ok(Applied::Deferred)
}

/// Записывает принятое с сервера. Вызывается внутри транзакции, где `sync_flags.applying = 1`.
pub async fn apply(conn: &mut SqliteConnection, change: &Change) -> AppResult<Applied> {
    let Some(s) = spec(&change.table) else {
        return Ok(Applied::Skipped);
    };
    if let Some(local_only) = s.local_only {
        let local: bool = sqlx::query_scalar(AssertSqlSafe(format!("SELECT {local_only} FROM (SELECT ?1 AS key)")))
            .bind(&change.uid)
            .fetch_one(&mut *conn)
            .await?;
        if local {
            return Ok(Applied::Skipped);
        }
    }
    let pending: Option<String> = sqlx::query_scalar("SELECT changed_at FROM sync_outbox WHERE tbl = ? AND key = ?")
        .bind(&change.table)
        .bind(&change.uid)
        .fetch_optional(&mut *conn)
        .await?;
    if pending.is_some_and(|at| at >= change.updated_at) {
        return Ok(Applied::Skipped);
    }
    sqlx::query("DELETE FROM sync_outbox WHERE tbl = ? AND key = ?").bind(&change.table).bind(&change.uid).execute(&mut *conn).await?;
    sqlx::query("DELETE FROM sync_inbox WHERE tbl = ? AND key = ?").bind(&change.table).bind(&change.uid).execute(&mut *conn).await?;

    let mut data = object(change.data.clone())?;
    if data.get("_deleted").and_then(Value::as_bool) == Some(true) {
        if let Some(sql) = delete_sql(s) {
            sqlx::query(AssertSqlSafe(sql)).bind(&change.uid).execute(&mut *conn).await?;
        }
        return Ok(Applied::Written);
    }
    for r in refs(&change.table, &data) {
        let key = data.remove(r.wire);
        let id = match key.as_ref().and_then(Value::as_str) {
            None => None,
            Some(key) => match lookup_id(conn, r.target.id_of_key(), key).await? {
                Some(id) => Some(id),
                None if r.required => return defer(conn, change).await,
                None => None,
            },
        };
        data.insert(r.local.into(), id.map_or(Value::Null, Value::from));
    }
    let payload = Value::Object(data).to_string();
    let mut written = false;
    for sql in write_sql(s) {
        written |= sqlx::query(AssertSqlSafe(sql)).bind(&change.uid).bind(&payload).execute(&mut *conn).await?.rows_affected() > 0;
    }
    Ok(if written { Applied::Written } else { Applied::Skipped })
}

/// Повторяет ожидающие записи, пока хоть одна применяется: этап дождался своего босса.
pub async fn retry_inbox(conn: &mut SqliteConnection) -> AppResult<usize> {
    let mut total = 0;
    loop {
        let waiting: Vec<(String, String, String, String)> =
            sqlx::query_as("SELECT tbl, key, updated_at, data FROM sync_inbox").fetch_all(&mut *conn).await?;
        let mut progressed = 0;
        for (table, uid, updated_at, raw) in waiting {
            let data = serde_json::from_str(&raw).map_err(|e| AppError::Invalid(e.to_string()))?;
            if apply(conn, &Change { table, uid, updated_at, data }).await? == Applied::Written {
                progressed += 1;
            }
        }
        if progressed == 0 {
            return Ok(total);
        }
        total += progressed;
    }
}

pub async fn set_applying(conn: &mut SqliteConnection, on: bool) -> AppResult<()> {
    sqlx::query("UPDATE sync_flags SET applying = ?").bind(i64::from(on)).execute(&mut *conn).await?;
    Ok(())
}

/// Отмечает все записи устройства к отправке: первая выгрузка героя в аккаунт.
pub async fn mark_all(conn: &mut SqliteConnection) -> AppResult<()> {
    for s in SPECS {
        let filter = s.local_only.map_or_else(String::new, |f| format!(" WHERE NOT ({f})"));
        let source = if s.table == "character" { "character WHERE id = 1".to_owned() } else { format!("{}{filter}", s.table) };
        sqlx::query(AssertSqlSafe(format!(
            "INSERT OR REPLACE INTO sync_outbox (tbl, key, changed_at) \
             SELECT DISTINCT '{}', {}, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM {source}",
            s.table, s.key
        )))
        .execute(&mut *conn)
        .await?;
    }
    Ok(())
}

/// Очищает летопись устройства перед приёмом героя из аккаунта. Настройки и справочники остаются.
pub async fn wipe(conn: &mut SqliteConnection) -> AppResult<()> {
    for sql in [
        "UPDATE equipment SET gear_id = NULL",
        "DELETE FROM ritual_completions",
        "DELETE FROM ledger",
        "DELETE FROM gear",
        "DELETE FROM inventory",
        "DELETE FROM quests",
        "DELETE FROM rituals",
        "DELETE FROM rewards",
        "DELETE FROM rest_actions",
        "DELETE FROM days",
        "DELETE FROM chronicle",
        "DELETE FROM achievements",
        "DELETE FROM crest_parts",
        "DELETE FROM week_goals",
        "DELETE FROM saga_chapters",
        "DELETE FROM inn_stays",
        "UPDATE character SET name = 'Странник', title = 'Странник', level = 1, xp = 0, gold = 0, strength = 0, \
         intellect = 0, agility = 0, streak_current = 0, streak_best = 0, wind_step = 0, fatigued_since = NULL, \
         location_key = 'gatehouse', loot_misses = 0, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1",
        "DELETE FROM sync_outbox",
        "DELETE FROM sync_inbox",
    ] {
        sqlx::query(sql).execute(&mut *conn).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_memory;
    use sqlx::SqlitePool;

    async fn outbox(pool: &SqlitePool) -> AppResult<Vec<Change>> {
        let mut conn = pool.acquire().await?;
        let rows: Vec<(String, String, String)> =
            sqlx::query_as("SELECT tbl, key, changed_at FROM sync_outbox ORDER BY changed_at, tbl, key").fetch_all(&mut *conn).await?;
        let mut changes = vec![];
        for (table, key, at) in rows {
            if let Some(c) = collect(&mut conn, &table, &key, &at).await? {
                changes.push(c);
            }
        }
        changes.sort_by_key(|c| rank(&c.table));
        Ok(changes)
    }

    async fn receive(pool: &SqlitePool, changes: &[Change]) -> AppResult<Vec<Applied>> {
        let mut tx = pool.begin().await?;
        set_applying(&mut tx, true).await?;
        let mut results = vec![];
        for c in changes {
            results.push(apply(&mut tx, c).await?);
        }
        retry_inbox(&mut tx).await?;
        set_applying(&mut tx, false).await?;
        tx.commit().await?;
        Ok(results)
    }

    async fn exec(pool: &SqlitePool, sql: &'static str) -> AppResult<()> {
        sqlx::query(sql).execute(pool).await?;
        Ok(())
    }

    async fn fresh() -> AppResult<SqlitePool> {
        let pool = open_memory().await?;
        let mut conn = pool.acquire().await?;
        set_applying(&mut conn, true).await?;
        wipe(&mut conn).await?;
        set_applying(&mut conn, false).await?;
        Ok(pool)
    }

    /// Босс с этапом, выполненный этап и его награда приходят на второе устройство даже задом наперёд.
    #[tokio::test]
    async fn boss_stage_and_ledger_travel_in_any_order() -> AppResult<()> {
        let pc = open_memory().await?;
        exec(&pc, "INSERT INTO quests (id, type, title, attribute) VALUES (10, 'boss', 'Диплом', 'intellect')").await?;
        exec(&pc, "INSERT INTO quests (id, parent_id, type, title, attribute, damage) VALUES (11, 10, 'stage', 'Введение', 'intellect', 2)").await?;
        exec(&pc, "INSERT INTO ledger (id, game_date, source_type, source_id, xp_delta, gold_delta) VALUES (5, '2026-10-27', 'quest', 11, 15, 4)").await?;
        exec(&pc, "INSERT INTO ledger (game_date, source_type, source_id, xp_delta, gold_delta, reverts_id, note) VALUES ('2026-10-27', 'revert', 11, -15, -4, 5, 'quest')").await?;
        exec(&pc, "UPDATE character SET name = 'Илья'").await?;

        let mut changes = outbox(&pc).await?;
        let ledger = changes.iter().find(|c| c.table == "ledger" && c.data["reverts"].is_null()).cloned();
        assert!(ledger.is_some_and(|c| c.data.get("source_id").is_none() && c.data["source"].is_string()), "в пакете ключи, а не id");
        changes.reverse();

        let phone = fresh().await?;
        let results = receive(&phone, &changes).await?;
        assert!(results.contains(&Applied::Deferred), "этап и отмена ждали свои связи");

        let parent: (String,) = sqlx::query_as(
            "SELECT p.title FROM quests s JOIN quests p ON p.id = s.parent_id WHERE s.title = 'Введение'",
        )
        .fetch_one(&phone)
        .await?;
        assert_eq!(parent.0, "Диплом");
        let rows: Vec<(String, Option<String>, Option<String>)> = sqlx::query_as(
            "SELECT l.source_type, q.title, (SELECT o.source_type FROM ledger o WHERE o.id = l.reverts_id) \
             FROM ledger l LEFT JOIN quests q ON q.id = l.source_id ORDER BY l.source_type",
        )
        .fetch_all(&phone)
        .await?;
        assert_eq!(
            rows,
            vec![
                ("quest".into(), Some("Введение".into()), None),
                ("revert".into(), Some("Введение".into()), Some("quest".into())),
            ]
        );
        let (name,): (String,) = sqlx::query_as("SELECT name FROM character").fetch_one(&phone).await?;
        assert_eq!(name, "Илья");
        let (waiting, echoed): (i64, i64) =
            sqlx::query_as("SELECT (SELECT count(*) FROM sync_inbox), (SELECT count(*) FROM sync_outbox)").fetch_one(&phone).await?;
        assert_eq!((waiting, echoed), (0, 0), "принятое не уходит обратно");
        Ok(())
    }

    /// Местная правка новее пришедшей: остаётся своя и ждёт отправки. Старая местная уступает.
    #[tokio::test]
    async fn newer_local_edit_wins() -> AppResult<()> {
        let pc = open_memory().await?;
        exec(&pc, "INSERT INTO rewards (uid, title, price) VALUES ('r1', 'Кино', 50)").await?;
        let incoming = Change {
            table: "rewards".into(),
            uid: "r1".into(),
            updated_at: "2000-01-01T00:00:00.000Z".into(),
            data: serde_json::json!({ "title": "Театр", "description": null, "price": 80, "repeatable": 1, "asset_key": null, "created_at": "2000-01-01T00:00:00.000Z", "archived_at": null }),
        };
        assert_eq!(receive(&pc, std::slice::from_ref(&incoming)).await?, vec![Applied::Skipped]);
        let newer = Change { updated_at: "2999-01-01T00:00:00.000Z".into(), ..incoming };
        assert_eq!(receive(&pc, &[newer]).await?, vec![Applied::Written]);
        let (title, price): (String, i64) = sqlx::query_as("SELECT title, price FROM rewards WHERE uid = 'r1'").fetch_one(&pc).await?;
        assert_eq!((title.as_str(), price), ("Театр", 80));
        Ok(())
    }

    /// Снятая отметка ритуала, отменённая находка и настройки: удаления доходят, анимации остаются свои.
    #[tokio::test]
    async fn deletions_and_settings_travel() -> AppResult<()> {
        let pc = open_memory().await?;
        exec(&pc, "INSERT INTO rituals (id, uid, title, attribute, start_date) VALUES (1, 'rit', 'Зарядка', 'strength', '2026-10-01')").await?;
        exec(&pc, "INSERT INTO ritual_completions (ritual_id, game_date) VALUES (1, '2026-10-27')").await?;
        exec(&pc, "INSERT INTO gear (uid, item_key, source_type, source_id, game_date) VALUES ('g1', 'wanderer_dagger', 'ritual', 1, '2026-10-27')").await?;
        exec(&pc, "UPDATE equipment SET gear_id = (SELECT id FROM gear) WHERE slot = 'weapon'").await?;
        exec(&pc, "UPDATE settings SET value = '45' WHERE key = 'rest_price'").await?;
        exec(&pc, "UPDATE settings SET value = '\"reduced\"' WHERE key = 'motion'").await?;
        let phone = fresh().await?;
        receive(&phone, &outbox(&pc).await?).await?;
        let (marks, worn): (i64, Option<String>) = sqlx::query_as(
            "SELECT (SELECT count(*) FROM ritual_completions), (SELECT g.item_key FROM equipment e JOIN gear g ON g.id = e.gear_id WHERE e.slot = 'weapon')",
        )
        .fetch_one(&phone)
        .await?;
        assert_eq!((marks, worn.as_deref()), (1, Some("wanderer_dagger")));
        let (price, motion): (String, String) = sqlx::query_as(
            "SELECT (SELECT value FROM settings WHERE key = 'rest_price'), (SELECT value FROM settings WHERE key = 'motion')",
        )
        .fetch_one(&phone)
        .await?;
        assert_eq!((price.as_str(), motion.as_str()), ("45", "\"full\""));

        exec(&pc, "DELETE FROM sync_outbox").await?;
        exec(&pc, "DELETE FROM ritual_completions").await?;
        exec(&pc, "DELETE FROM gear").await?;
        let gone = outbox(&pc).await?;
        assert!(gone.iter().any(|c| c.table == "gear" && c.data["_deleted"] == true));
        receive(&phone, &gone).await?;
        let (marks, gear, worn): (i64, i64, Option<i64>) = sqlx::query_as(
            "SELECT (SELECT count(*) FROM ritual_completions), (SELECT count(*) FROM gear), (SELECT gear_id FROM equipment WHERE slot = 'weapon')",
        )
        .fetch_one(&phone)
        .await?;
        assert_eq!((marks, gear, worn), (0, 0, None));
        Ok(())
    }

    /// Цели недели ходят одним набором, журнал не дублируется, пересчёт кэша не порождает отправок.
    #[tokio::test]
    async fn week_goals_ledger_and_cache() -> AppResult<()> {
        let pc = open_memory().await?;
        exec(&pc, "INSERT INTO week_goals (uid, week_start, goal_key, target) VALUES ('w1', '2026-10-26', 'deeds', 10), ('w2', '2026-10-26', 'rituals', 5)").await?;
        exec(&pc, "INSERT INTO ledger (uid, game_date, source_type, source_id, gold_delta, note) VALUES ('l1', '2026-10-27', 'week_chest', (SELECT id FROM week_goals WHERE uid = 'w1'), 20, 'goal:deeds')").await?;
        let changes = outbox(&pc).await?;
        assert_eq!(changes.iter().filter(|c| c.table == "week_goals").count(), 1);
        let phone = fresh().await?;
        exec(&phone, "INSERT INTO week_goals (uid, week_start, goal_key, target) VALUES ('x1', '2026-10-26', 'bosses', 1)").await?;
        exec(&phone, "DELETE FROM sync_outbox").await?;
        receive(&phone, &changes).await?;
        receive(&phone, &changes).await?;
        let goals: Vec<(String,)> = sqlx::query_as("SELECT goal_key FROM week_goals ORDER BY goal_key").fetch_all(&phone).await?;
        assert_eq!(goals, vec![("deeds".into(),), ("rituals".into(),)]);
        let (entries, linked): (i64, Option<String>) = sqlx::query_as(
            "SELECT (SELECT count(*) FROM ledger), (SELECT w.goal_key FROM week_goals w JOIN ledger l ON l.source_id = w.id)",
        )
        .fetch_one(&phone)
        .await?;
        assert_eq!((entries, linked.as_deref()), (1, Some("deeds")));

        exec(&phone, "UPDATE character SET gold = 20, xp = 3").await?;
        exec(&phone, "INSERT INTO days (game_date, kind, deeds_count) VALUES ('2026-10-27', 'normal', 0) ON CONFLICT(game_date) DO UPDATE SET kind = excluded.kind, deeds_count = 2").await?;
        exec(&phone, "DELETE FROM sync_outbox WHERE tbl = 'days'").await?;
        exec(&phone, "INSERT INTO days (game_date, kind, deeds_count) VALUES ('2026-10-27', 'normal', 3) ON CONFLICT(game_date) DO UPDATE SET kind = excluded.kind, deeds_count = excluded.deeds_count").await?;
        let (pending,): (i64,) = sqlx::query_as("SELECT count(*) FROM sync_outbox").fetch_one(&phone).await?;
        assert_eq!(pending, 0);
        Ok(())
    }

    /// Первая выгрузка отмечает всю летопись, кроме настроек устройства.
    #[tokio::test]
    async fn mark_all_covers_the_chronicle() -> AppResult<()> {
        let pool = open_memory().await?;
        exec(&pool, "DELETE FROM sync_outbox").await?;
        let mut conn = pool.acquire().await?;
        mark_all(&mut conn).await?;
        let tables: Vec<(String, i64)> =
            sqlx::query_as("SELECT tbl, count(*) FROM sync_outbox GROUP BY tbl ORDER BY tbl").fetch_all(&mut *conn).await?;
        assert!(tables.contains(&("character".into(), 1)));
        assert!(tables.contains(&("equipment".into(), 5)));
        assert!(tables.contains(&("rest_actions".into(), 4)));
        let (local,): (i64,) =
            sqlx::query_as("SELECT count(*) FROM sync_outbox WHERE tbl = 'settings' AND key IN ('motion', 'sound_enabled', 'reminder')").fetch_one(&mut *conn).await?;
        assert_eq!(local, 0);
        Ok(())
    }

    /// Комната в таверне и прочитанная глава Сказа доходят до второго устройства, отмена комнаты тоже.
    #[tokio::test]
    async fn inn_and_saga_travel() -> AppResult<()> {
        let pc = open_memory().await?;
        exec(&pc, "DELETE FROM sync_outbox").await?;
        exec(&pc, "INSERT INTO inn_stays (uid, start_date, end_date) VALUES ('inn1', '2026-10-28', '2026-10-30')").await?;
        exec(&pc, "INSERT INTO saga_chapters (key, uid) VALUES ('ch01', 's1')").await?;
        exec(&pc, "UPDATE saga_chapters SET read_at = '2026-10-27T10:00:00.000Z'").await?;
        let phone = fresh().await?;
        receive(&phone, &outbox(&pc).await?).await?;
        exec(&pc, "DELETE FROM sync_outbox").await?;
        exec(&pc, "UPDATE inn_stays SET deleted_at = '2026-10-27T11:00:00.000Z'").await?;
        receive(&phone, &outbox(&pc).await?).await?;
        let (stay, read): (Option<String>, Option<String>) = sqlx::query_as(
            "SELECT (SELECT deleted_at FROM inn_stays WHERE uid = 'inn1'), (SELECT read_at FROM saga_chapters WHERE key = 'ch01')",
        )
        .fetch_one(&phone)
        .await?;
        assert_eq!((stay.as_deref(), read.as_deref()), (Some("2026-10-27T11:00:00.000Z"), Some("2026-10-27T10:00:00.000Z")));
        Ok(())
    }
}

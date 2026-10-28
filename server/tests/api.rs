//! Проверки API на настоящем Postgres: каждый тест получает свою чистую базу (`DATABASE_URL`).

use axum::Router;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use sqlx::PgPool;
use tower::ServiceExt;

async fn call(app: &Router, method: &str, uri: &str, token: Option<&str>, body: Option<Value>) -> (StatusCode, Value) {
    call_from(app, "203.0.113.1", method, uri, token, body).await
}

/// Запрос с адреса `ip`: его видит сервер, который стоит за прокси (`trust_proxy`).
async fn call_from(app: &Router, ip: &str, method: &str, uri: &str, token: Option<&str>, body: Option<Value>) -> (StatusCode, Value) {
    let mut req = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json")
        .header("x-forwarded-for", format!("10.0.0.9, {ip}"));
    if let Some(t) = token {
        req = req.header("authorization", format!("Bearer {t}"));
    }
    let body = body.map_or_else(Body::empty, |b| Body::from(b.to_string()));
    let res = app.clone().oneshot(req.body(body).expect("запрос")).await.expect("ответ");
    let status = res.status();
    let bytes = res.into_body().collect().await.expect("тело").to_bytes();
    let value = if bytes.is_empty() { Value::Null } else { serde_json::from_slice(&bytes).expect("json") };
    (status, value)
}

async fn session(app: &Router, path: &str, email: &str, device: &str) -> (String, String) {
    let (status, body) =
        call(app, "POST", path, None, Some(json!({ "email": email, "password": "секретный-пароль", "device_name": device }))).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    (body["token"].as_str().expect("token").to_owned(), body["device_id"].as_str().expect("device").to_owned())
}

fn quest(uid: &str, updated_at: &str, title: &str) -> Value {
    json!({ "table": "quests", "uid": uid, "updated_at": updated_at, "data": { "title": title } })
}

async fn pull_all(app: &Router, token: &str) -> Vec<Value> {
    let (status, body) = call(app, "GET", "/v1/sync/pull?after=0", Some(token), None).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    body["changes"].as_array().expect("changes").clone()
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn register_login_and_wrong_password(db: PgPool) {
    let app = guild_sync::app(db);
    session(&app, "/v1/auth/register", "Ilya@Example.com", "ПК").await;

    let (status, body) =
        call(&app, "POST", "/v1/auth/register", None, Some(json!({ "email": "ilya@example.com", "password": "другой-пароль", "device_name": "ПК" }))).await;
    assert_eq!(status, StatusCode::CONFLICT);
    assert_eq!(body["kind"], "email_taken");

    session(&app, "/v1/auth/login", "ilya@example.com", "Телефон").await;

    let (status, body) =
        call(&app, "POST", "/v1/auth/login", None, Some(json!({ "email": "ilya@example.com", "password": "не-тот-пароль", "device_name": "x" }))).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["kind"], "bad_credentials");
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn login_pauses_after_five_failures(db: PgPool) {
    let app = guild_sync::app(db);
    session(&app, "/v1/auth/register", "a@b.ru", "ПК").await;
    let wrong = json!({ "email": "a@b.ru", "password": "не-тот-пароль", "device_name": "x" });
    for _ in 0..5 {
        let (status, _) = call(&app, "POST", "/v1/auth/login", None, Some(wrong.clone())).await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
    }
    let right = json!({ "email": "a@b.ru", "password": "секретный-пароль", "device_name": "x" });
    let (status, body) = call(&app, "POST", "/v1/auth/login", None, Some(right)).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert_eq!(body["kind"], "too_many_attempts");
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn sync_needs_a_token(db: PgPool) {
    let app = guild_sync::app(db);
    let (status, _) = call(&app, "GET", "/v1/sync/pull", None, None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let (status, _) = call(&app, "GET", "/v1/sync/pull", Some("выдуманный"), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn changes_travel_to_the_other_device_only(db: PgPool) {
    let app = guild_sync::app(db);
    let (pc, _) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    let (phone, _) = session(&app, "/v1/auth/login", "ilya@example.com", "Телефон").await;

    let (status, body) =
        call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [quest("q1", "2026-10-27T10:00:00.000Z", "Отчёт")] }))).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["accepted"], 1);

    assert!(pull_all(&app, &pc).await.is_empty(), "своё устройству не возвращается");
    let got = pull_all(&app, &phone).await;
    assert_eq!(got, vec![quest("q1", "2026-10-27T10:00:00.000Z", "Отчёт")]);

    let (_, body) = call(&app, "GET", "/v1/sync/pull?after=0", Some(&pc), None).await;
    assert!(body["cursor"].as_i64().expect("cursor") > 0, "курсор сдвигается и за свои записи");
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn newer_edit_wins_older_is_ignored(db: PgPool) {
    let app = guild_sync::app(db);
    let (pc, _) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    let (phone, _) = session(&app, "/v1/auth/login", "ilya@example.com", "Телефон").await;
    let (tablet, _) = session(&app, "/v1/auth/login", "ilya@example.com", "Планшет").await;

    call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [quest("q1", "2026-10-27T10:00:00.000Z", "Старое")] }))).await;
    let (_, body) =
        call(&app, "POST", "/v1/sync/push", Some(&phone), Some(json!({ "changes": [quest("q1", "2026-10-27T11:00:00.000Z", "Новое")] }))).await;
    assert_eq!(body["accepted"], 1);
    let (_, body) =
        call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [quest("q1", "2026-10-27T10:30:00.000Z", "Запоздалое")] }))).await;
    assert_eq!(body["accepted"], 0, "правка старше хранимой не принимается");

    assert_eq!(pull_all(&app, &tablet).await, vec![quest("q1", "2026-10-27T11:00:00.000Z", "Новое")]);
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn ledger_is_append_only(db: PgPool) {
    let app = guild_sync::app(db);
    let (pc, _) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    let (phone, _) = session(&app, "/v1/auth/login", "ilya@example.com", "Телефон").await;
    let entry = |at: &str, gold: i64| json!({ "table": "ledger", "uid": "l1", "updated_at": at, "data": { "gold_delta": gold } });

    call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [entry("2026-10-27T10:00:00.000Z", 3)] }))).await;
    let (_, body) = call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [entry("2026-10-27T12:00:00.000Z", 999)] }))).await;
    assert_eq!(body["accepted"], 0);

    assert_eq!(pull_all(&app, &phone).await, vec![entry("2026-10-27T10:00:00.000Z", 3)]);
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn accounts_do_not_see_each_other(db: PgPool) {
    let app = guild_sync::app(db);
    let (ilya, _) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    let (other, _) = session(&app, "/v1/auth/register", "other@example.com", "ПК").await;
    call(&app, "POST", "/v1/sync/push", Some(&ilya), Some(json!({ "changes": [quest("q1", "2026-10-27T10:00:00.000Z", "Тайное")] }))).await;
    assert!(pull_all(&app, &other).await.is_empty());
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn pull_pages_through_cursor(db: PgPool) {
    let app = guild_sync::app(db);
    let (pc, _) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    let (phone, _) = session(&app, "/v1/auth/login", "ilya@example.com", "Телефон").await;
    let changes: Vec<Value> = (0..600).map(|i| quest(&format!("q{i}"), "2026-10-27T10:00:00.000Z", "Дело")).collect();
    call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": changes }))).await;

    let (_, first) = call(&app, "GET", "/v1/sync/pull?after=0", Some(&phone), None).await;
    assert_eq!(first["changes"].as_array().map(Vec::len), Some(500));
    assert_eq!(first["more"], true);
    let cursor = first["cursor"].as_i64().expect("cursor");
    let (_, second) = call(&app, "GET", &format!("/v1/sync/pull?after={cursor}"), Some(&phone), None).await;
    assert_eq!(second["changes"].as_array().map(Vec::len), Some(100));
    assert_eq!(second["more"], false);
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn malformed_changes_are_rejected(db: PgPool) {
    let app = guild_sync::app(db);
    let (pc, _) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    for bad in [
        json!({ "table": "Quests", "uid": "q1", "updated_at": "2026-10-27T10:00:00.000Z", "data": {} }),
        json!({ "table": "quests", "uid": "q 1", "updated_at": "2026-10-27T10:00:00.000Z", "data": {} }),
        json!({ "table": "quests", "uid": "q1", "updated_at": "вчера", "data": {} }),
        json!({ "table": "quests", "uid": "q1", "updated_at": "2026-10-27T10:00:00.000Z", "data": [1] }),
    ] {
        let (status, body) = call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [bad] }))).await;
        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY, "{body}");
    }
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn logout_revokes_and_delete_wipes(db: PgPool) {
    let app = guild_sync::app(db.clone());
    let (pc, _) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    let (phone, _) = session(&app, "/v1/auth/login", "ilya@example.com", "Телефон").await;
    call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [quest("q1", "2026-10-27T10:00:00.000Z", "Дело")] }))).await;

    let (status, _) = call(&app, "POST", "/v1/auth/logout", Some(&phone), None).await;
    assert_eq!(status, StatusCode::OK);
    let (status, _) = call(&app, "GET", "/v1/sync/pull", Some(&phone), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (status, _) = call(&app, "DELETE", "/v1/account", Some(&pc), Some(json!({ "password": "не-тот" }))).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let (status, _) = call(&app, "DELETE", "/v1/account", Some(&pc), Some(json!({ "password": "секретный-пароль" }))).await;
    assert_eq!(status, StatusCode::OK);
    let (left,): (i64,) = sqlx::query_as("SELECT count(*) FROM records").fetch_one(&db).await.expect("count");
    assert_eq!(left, 0);
    let (status, _) = call(&app, "GET", "/v1/sync/pull", Some(&pc), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

fn behind_proxy(db: PgPool) -> Router {
    guild_sync::app_with(db, guild_sync::Config { trust_proxy: true })
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn failed_logins_from_one_address_do_not_lock_out_another(db: PgPool) {
    let app = behind_proxy(db);
    session(&app, "/v1/auth/register", "a@b.ru", "ПК").await;
    let wrong = json!({ "email": "a@b.ru", "password": "не-тот-пароль", "device_name": "x" });
    for _ in 0..5 {
        call_from(&app, "198.51.100.7", "POST", "/v1/auth/login", None, Some(wrong.clone())).await;
    }
    let right = json!({ "email": "a@b.ru", "password": "секретный-пароль", "device_name": "x" });
    let (status, _) = call_from(&app, "198.51.100.7", "POST", "/v1/auth/login", None, Some(right.clone())).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS, "подбирающий адрес на паузе");
    let (status, body) = call_from(&app, "192.0.2.44", "POST", "/v1/auth/login", None, Some(right)).await;
    assert_eq!(status, StatusCode::OK, "хозяин аккаунта с другого адреса входит: {body}");
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn one_address_cannot_flood_signups(db: PgPool) {
    let app = behind_proxy(db);
    for i in 0..5 {
        session(&app, "/v1/auth/register", &format!("hero{i}@b.ru"), "ПК").await;
    }
    let extra = json!({ "email": "hero5@b.ru", "password": "секретный-пароль", "device_name": "ПК" });
    let (status, _) = call(&app, "POST", "/v1/auth/register", None, Some(extra.clone())).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    let (status, _) = call_from(&app, "192.0.2.44", "POST", "/v1/auth/register", None, Some(extra)).await;
    assert_eq!(status, StatusCode::OK);
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn password_change_signs_out_other_devices(db: PgPool) {
    let app = guild_sync::app(db);
    let (pc, _) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    let (phone, _) = session(&app, "/v1/auth/login", "ilya@example.com", "Телефон").await;

    let (status, _) =
        call(&app, "POST", "/v1/auth/password", Some(&pc), Some(json!({ "password": "не-тот", "new_password": "новый-пароль-1" }))).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let (status, _) =
        call(&app, "POST", "/v1/auth/password", Some(&pc), Some(json!({ "password": "секретный-пароль", "new_password": "коротко" }))).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    let (status, body) = call(
        &app,
        "POST",
        "/v1/auth/password",
        Some(&pc),
        Some(json!({ "password": "секретный-пароль", "new_password": "новый-пароль-1" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK, "{body}");

    let (status, _) = call(&app, "GET", "/v1/sync/pull", Some(&pc), None).await;
    assert_eq!(status, StatusCode::OK, "устройство, сменившее пароль, остаётся");
    let (status, _) = call(&app, "GET", "/v1/sync/pull", Some(&phone), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED, "остальные выходят");

    let old = json!({ "email": "ilya@example.com", "password": "секретный-пароль", "device_name": "x" });
    let (status, _) = call(&app, "POST", "/v1/auth/login", None, Some(old)).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    let new = json!({ "email": "ilya@example.com", "password": "новый-пароль-1", "device_name": "x" });
    let (status, _) = call(&app, "POST", "/v1/auth/login", None, Some(new)).await;
    assert_eq!(status, StatusCode::OK);
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn idle_session_expires(db: PgPool) {
    let app = guild_sync::app(db.clone());
    let (pc, device) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    sqlx::query("UPDATE devices SET last_seen_at = now() - make_interval(days => $2) - interval '1 minute' WHERE id = $1")
        .bind(&device)
        .bind(guild_sync::auth::SESSION_IDLE_DAYS)
        .execute(&db)
        .await
        .expect("состарить");
    let (status, _) = call(&app, "GET", "/v1/sync/pull", Some(&pc), None).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
}

#[sqlx::test(migrator = "guild_sync::MIGRATOR")]
async fn full_account_takes_edits_but_not_new_records(db: PgPool) {
    let app = guild_sync::app(db.clone());
    let (pc, device) = session(&app, "/v1/auth/register", "ilya@example.com", "ПК").await;
    call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [quest("q1", "2026-10-27T10:00:00.000Z", "Дело")] }))).await;
    sqlx::query(
        "INSERT INTO records (user_id, tbl, uid, updated_at, device_id, data)
         SELECT u.id, 'chronicle', 'c' || g, '2026-10-27T10:00:00.000Z', $1, '{}'::jsonb
         FROM users u, generate_series(2, $2) g",
    )
    .bind(&device)
    .bind(guild_sync::sync::MAX_RECORDS)
    .execute(&db)
    .await
    .expect("наполнить");

    let (status, body) =
        call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [quest("q2", "2026-10-27T10:00:00.000Z", "Новое")] }))).await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE, "{body}");
    assert_eq!(body["kind"], "quota_exceeded");
    let (status, body) =
        call(&app, "POST", "/v1/sync/push", Some(&pc), Some(json!({ "changes": [quest("q1", "2026-10-27T11:00:00.000Z", "Правка")] }))).await;
    assert_eq!(status, StatusCode::OK, "правка старой записи проходит: {body}");
}

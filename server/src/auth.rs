use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::{Duration, Instant};

use argon2::password_hash::{PasswordHasher, PasswordVerifier};
use argon2::Argon2;
use axum::extract::{ConnectInfo, FromRequestParts, State};
use axum::http::request::Parts;
use axum::Json;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::AppState;

/// Счётчик в окне времени: не больше `max` событий за `period`.
struct Rule {
    max: u32,
    period: Duration,
}

/// Неудачные попытки пароля с одного адреса для одного аккаунта.
const FAILS_PER_ACCOUNT_AND_IP: Rule = Rule { max: 5, period: Duration::from_secs(60) };
/// Неудачные попытки с одного адреса по любым аккаунтам.
const FAILS_PER_IP: Rule = Rule { max: 30, period: Duration::from_secs(15 * 60) };
/// Неудачные попытки по одному аккаунту со всех адресов: подбор из многих мест.
const FAILS_PER_ACCOUNT: Rule = Rule { max: 50, period: Duration::from_secs(60 * 60) };
/// Новые аккаунты с одного адреса.
const SIGNUPS_PER_IP: Rule = Rule { max: 5, period: Duration::from_secs(60 * 60) };
/// Запросы одного токена.
const REQUESTS_PER_TOKEN: Rule = Rule { max: 10, period: Duration::from_secs(1) };
/// Сессия, которой не пользовались столько дней, гаснет: украденный старый токен бесполезен.
pub const SESSION_IDLE_DAYS: i32 = 90;

#[derive(Deserialize)]
pub struct Credentials {
    email: String,
    password: String,
    device_name: String,
}

#[derive(Serialize)]
pub struct SessionOut {
    token: String,
    device_id: String,
}

#[derive(Deserialize)]
pub struct PasswordIn {
    password: String,
}

#[derive(Deserialize)]
pub struct NewPasswordIn {
    password: String,
    new_password: String,
}

/// Адрес клиента. За обратным прокси (`TRUST_PROXY`) берётся последний адрес из
/// `X-Forwarded-For`: его дописал сам прокси, остальные мог подставить клиент.
pub struct ClientIp(pub String);

/// Вошедшее устройство: из заголовка `Authorization: Bearer <токен>`.
pub struct Session {
    pub user_id: i64,
    pub device_id: String,
    token_hash: String,
}

fn normalize_email(raw: &str) -> ApiResult<String> {
    let email = raw.trim().to_lowercase();
    let valid = email.len() <= 254 && email.split_once('@').is_some_and(|(name, host)| !name.is_empty() && host.contains('.'));
    if valid { Ok(email) } else { Err(ApiError::Invalid("Похоже, в e-mail опечатка".into())) }
}

fn check_password(password: &str) -> ApiResult<()> {
    let len = password.chars().count();
    if (8..=128).contains(&len) { Ok(()) } else { Err(ApiError::Invalid("Пароль нужен от 8 до 128 символов".into())) }
}

fn device_name(raw: &str) -> ApiResult<String> {
    let name: String = raw.trim().chars().take(60).collect();
    if name.is_empty() { Err(ApiError::Invalid("Назови устройство".into())) } else { Ok(name) }
}

pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

/// Argon2 тратит память и процессор, поэтому одновременно идёт не больше `ARGON_SLOTS` проверок.
async fn hash_password(state: &AppState, password: String) -> ApiResult<String> {
    let _slot = state.argon.acquire().await.map_err(|e| ApiError::Internal(format!("очередь argon2: {e}")))?;
    tokio::task::spawn_blocking(move || {
        Argon2::default()
            .hash_password(password.as_bytes())
            .map(|h| h.to_string())
            .map_err(|e| ApiError::Internal(format!("argon2: {e}")))
    })
    .await
    .map_err(|e| ApiError::Internal(format!("пул задач: {e}")))?
}

async fn password_matches(state: &AppState, password: String, hash: String) -> ApiResult<bool> {
    let _slot = state.argon.acquire().await.map_err(|e| ApiError::Internal(format!("очередь argon2: {e}")))?;
    tokio::task::spawn_blocking(move || Argon2::default().verify_password(password.as_bytes(), hash.as_str()).is_ok())
        .await
        .map_err(|e| ApiError::Internal(format!("пул задач: {e}")))
}

/// Хеш-приманка: вход с несуществующим e-mail проверяется так же долго, как с настоящим,
/// и по времени ответа нельзя узнать, есть ли такой аккаунт.
async fn decoy_hash(state: &AppState) -> ApiResult<String> {
    state.decoy.get_or_try_init(|| hash_password(state, "приманка для несуществующего аккаунта".into())).await.cloned()
}

/// Проверка пароля с учётом лимитов неудач. `hash` есть, только если аккаунт существует.
async fn verify_password(state: &AppState, ip: &str, account: &str, password: String, hash: Option<String>) -> ApiResult<bool> {
    state.limits.check_password_attempt(ip, account)?;
    let (real, hash) = match hash {
        Some(h) => (true, h),
        None => (false, decoy_hash(state).await?),
    };
    let ok = password_matches(state, password, hash).await? && real;
    if ok {
        state.limits.password_succeeded(ip, account);
    } else {
        state.limits.password_failed(ip, account);
    }
    Ok(ok)
}

/// Новая сессия для устройства: токен уходит клиенту, в базе остаётся только его хеш.
async fn open_session(state: &AppState, user_id: i64, name: &str) -> ApiResult<SessionOut> {
    let device_id = Uuid::new_v4().to_string();
    let token = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let mut tx = state.db.begin().await?;
    sqlx::query("INSERT INTO devices (id, user_id, name) VALUES ($1, $2, $3)")
        .bind(&device_id)
        .bind(user_id)
        .bind(name)
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO sessions (token_hash, user_id, device_id) VALUES ($1, $2, $3)")
        .bind(hash_token(&token))
        .bind(user_id)
        .bind(&device_id)
        .execute(&mut *tx)
        .await?;
    // Заодно убираем погасшие сессии этого аккаунта.
    sqlx::query("DELETE FROM devices WHERE user_id = $1 AND last_seen_at <= now() - make_interval(days => $2)")
        .bind(user_id)
        .bind(SESSION_IDLE_DAYS)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(SessionOut { token, device_id })
}

pub async fn register(State(state): State<AppState>, ClientIp(ip): ClientIp, Json(input): Json<Credentials>) -> ApiResult<Json<SessionOut>> {
    let email = normalize_email(&input.email)?;
    check_password(&input.password)?;
    let name = device_name(&input.device_name)?;
    state.limits.signup(&ip)?;
    let hash = hash_password(&state, input.password).await?;
    let inserted: Option<(i64,)> =
        sqlx::query_as("INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id")
            .bind(&email)
            .bind(&hash)
            .fetch_optional(&state.db)
            .await?;
    let (user_id,) = inserted.ok_or(ApiError::EmailTaken)?;
    Ok(Json(open_session(&state, user_id, &name).await?))
}

pub async fn login(State(state): State<AppState>, ClientIp(ip): ClientIp, Json(input): Json<Credentials>) -> ApiResult<Json<SessionOut>> {
    let email = normalize_email(&input.email)?;
    let name = device_name(&input.device_name)?;
    let row: Option<(i64, String)> = sqlx::query_as("SELECT id, password_hash FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&state.db)
        .await?;
    let (id, hash) = row.map_or((None, None), |(id, hash)| (Some(id), Some(hash)));
    if !verify_password(&state, &ip, &email, input.password, hash).await? {
        return Err(ApiError::BadCredentials);
    }
    let user = id.ok_or(ApiError::BadCredentials)?;
    Ok(Json(open_session(&state, user, &name).await?))
}

/// Пароль аккаунта и e-mail для лимитов по вошедшей сессии.
async fn account_of(state: &AppState, session: &Session) -> ApiResult<(String, String)> {
    Ok(sqlx::query_as("SELECT email, password_hash FROM users WHERE id = $1").bind(session.user_id).fetch_one(&state.db).await?)
}

/// Смена пароля. Все остальные устройства выходят: если токен или пароль утекли, это их гасит.
pub async fn change_password(
    State(state): State<AppState>,
    ClientIp(ip): ClientIp,
    session: Session,
    Json(input): Json<NewPasswordIn>,
) -> ApiResult<Json<()>> {
    check_password(&input.new_password)?;
    let (email, hash) = account_of(&state, &session).await?;
    if !verify_password(&state, &ip, &email, input.password, Some(hash)).await? {
        return Err(ApiError::BadCredentials);
    }
    let new_hash = hash_password(&state, input.new_password).await?;
    let mut tx = state.db.begin().await?;
    sqlx::query("UPDATE users SET password_hash = $2 WHERE id = $1").bind(session.user_id).bind(&new_hash).execute(&mut *tx).await?;
    sqlx::query("DELETE FROM devices WHERE user_id = $1 AND id <> $2")
        .bind(session.user_id)
        .bind(&session.device_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;
    Ok(Json(()))
}

pub async fn logout(State(state): State<AppState>, session: Session) -> ApiResult<Json<()>> {
    sqlx::query("DELETE FROM devices WHERE id = $1").bind(&session.device_id).execute(&state.db).await?;
    state.limits.forget_token(&session.token_hash);
    Ok(Json(()))
}

/// Удаление аккаунта со всеми записями. Пароль спрашивается ещё раз, одного токена мало.
pub async fn delete_account(
    State(state): State<AppState>,
    ClientIp(ip): ClientIp,
    session: Session,
    Json(input): Json<PasswordIn>,
) -> ApiResult<Json<()>> {
    let (email, hash) = account_of(&state, &session).await?;
    if !verify_password(&state, &ip, &email, input.password, Some(hash)).await? {
        return Err(ApiError::BadCredentials);
    }
    sqlx::query("DELETE FROM users WHERE id = $1").bind(session.user_id).execute(&state.db).await?;
    Ok(Json(()))
}

impl FromRequestParts<AppState> for Session {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> ApiResult<Self> {
        let token = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "))
            .ok_or(ApiError::Unauthorized)?;
        let token_hash = hash_token(token.trim());
        state.limits.check_rate(&token_hash)?;
        let row: Option<(i64, String)> = sqlx::query_as(
            "UPDATE devices d SET last_seen_at = now() FROM sessions s
             WHERE s.token_hash = $1 AND d.id = s.device_id
               AND d.last_seen_at > now() - make_interval(days => $2)
             RETURNING s.user_id, s.device_id",
        )
        .bind(&token_hash)
        .bind(SESSION_IDLE_DAYS)
        .fetch_optional(&state.db)
        .await?;
        let (user_id, device_id) = row.ok_or(ApiError::Unauthorized)?;
        Ok(Self { user_id, device_id, token_hash })
    }
}

impl FromRequestParts<AppState> for ClientIp {
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &AppState) -> ApiResult<Self> {
        if state.trust_proxy {
            let forwarded = parts
                .headers
                .get("x-forwarded-for")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.rsplit(',').next())
                .map(str::trim)
                .filter(|v| !v.is_empty());
            if let Some(ip) = forwarded {
                return Ok(Self(ip.to_owned()));
            }
        }
        let direct = parts.extensions.get::<ConnectInfo<SocketAddr>>().map(|c| c.0.ip().to_string());
        Ok(Self(direct.unwrap_or_else(|| "unknown".to_owned())))
    }
}

struct Window {
    start: Instant,
    count: u32,
}

/// Счётчики событий по ключу, каждый в своём окне времени.
#[derive(Default)]
struct Counters(HashMap<String, Window>);

impl Counters {
    fn count(&self, key: &str, rule: &Rule) -> u32 {
        self.0.get(key).filter(|w| w.start.elapsed() < rule.period).map_or(0, |w| w.count)
    }

    fn bump(&mut self, key: &str, rule: &Rule) -> u32 {
        if self.0.len() > 10_000 {
            self.0.retain(|_, w| w.start.elapsed() < rule.period);
        }
        let window = self.0.entry(key.to_owned()).or_insert(Window { start: Instant::now(), count: 0 });
        if window.start.elapsed() >= rule.period {
            *window = Window { start: Instant::now(), count: 0 };
        }
        window.count += 1;
        window.count
    }

    fn forget(&mut self, key: &str) {
        self.0.remove(key);
    }
}

#[derive(Default)]
struct LimitsInner {
    failed_pair: Counters,
    failed_ip: Counters,
    failed_account: Counters,
    signups: Counters,
    requests: Counters,
}

/// Ограничения в памяти процесса: паузы после неудачных паролей, число новых аккаунтов
/// с адреса и частота запросов на токен. Ключи по адресу не дают одному человеку
/// заблокировать чужой аккаунт с другого адреса надолго.
#[derive(Default)]
pub struct Limits(std::sync::Mutex<LimitsInner>);

fn pair(ip: &str, account: &str) -> String {
    format!("{ip}|{account}")
}

impl Limits {
    fn with<T>(&self, f: impl FnOnce(&mut LimitsInner) -> T) -> T {
        let mut guard = match self.0.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        f(&mut guard)
    }

    fn check_password_attempt(&self, ip: &str, account: &str) -> ApiResult<()> {
        self.with(|l| {
            let blocked = l.failed_pair.count(&pair(ip, account), &FAILS_PER_ACCOUNT_AND_IP) >= FAILS_PER_ACCOUNT_AND_IP.max
                || l.failed_ip.count(ip, &FAILS_PER_IP) >= FAILS_PER_IP.max
                || l.failed_account.count(account, &FAILS_PER_ACCOUNT) >= FAILS_PER_ACCOUNT.max;
            if blocked { Err(ApiError::TooManyAttempts) } else { Ok(()) }
        })
    }

    fn password_failed(&self, ip: &str, account: &str) {
        self.with(|l| {
            l.failed_pair.bump(&pair(ip, account), &FAILS_PER_ACCOUNT_AND_IP);
            l.failed_ip.bump(ip, &FAILS_PER_IP);
            l.failed_account.bump(account, &FAILS_PER_ACCOUNT);
        });
    }

    fn password_succeeded(&self, ip: &str, account: &str) {
        self.with(|l| l.failed_pair.forget(&pair(ip, account)));
    }

    fn signup(&self, ip: &str) -> ApiResult<()> {
        self.with(|l| if l.signups.bump(ip, &SIGNUPS_PER_IP) > SIGNUPS_PER_IP.max { Err(ApiError::TooManyAttempts) } else { Ok(()) })
    }

    fn forget_token(&self, token_hash: &str) {
        self.with(|l| l.requests.forget(token_hash));
    }

    fn check_rate(&self, token_hash: &str) -> ApiResult<()> {
        self.with(|l| {
            if l.requests.bump(token_hash, &REQUESTS_PER_TOKEN) > REQUESTS_PER_TOKEN.max { Err(ApiError::TooManyAttempts) } else { Ok(()) }
        })
    }
}

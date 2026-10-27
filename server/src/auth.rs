use std::time::{Duration, Instant};

use argon2::password_hash::{PasswordHasher, PasswordVerifier};
use argon2::Argon2;
use axum::extract::{FromRequestParts, State};
use axum::http::request::Parts;
use axum::Json;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::error::{ApiError, ApiResult};
use crate::AppState;

const MAX_FAILED_LOGINS: u32 = 5;
const LOGIN_PAUSE: Duration = Duration::from_secs(60);
const REQUESTS_PER_SECOND: u32 = 10;

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

async fn hash_password(password: String) -> ApiResult<String> {
    tokio::task::spawn_blocking(move || {
        Argon2::default()
            .hash_password(password.as_bytes())
            .map(|h| h.to_string())
            .map_err(|e| ApiError::Internal(format!("argon2: {e}")))
    })
    .await
    .map_err(|e| ApiError::Internal(format!("пул задач: {e}")))?
}

async fn password_matches(password: String, hash: String) -> ApiResult<bool> {
    tokio::task::spawn_blocking(move || Argon2::default().verify_password(password.as_bytes(), hash.as_str()).is_ok())
        .await
        .map_err(|e| ApiError::Internal(format!("пул задач: {e}")))
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
    tx.commit().await?;
    Ok(SessionOut { token, device_id })
}

pub async fn register(State(state): State<AppState>, Json(input): Json<Credentials>) -> ApiResult<Json<SessionOut>> {
    let email = normalize_email(&input.email)?;
    check_password(&input.password)?;
    let name = device_name(&input.device_name)?;
    let hash = hash_password(input.password).await?;
    let inserted: Option<(i64,)> =
        sqlx::query_as("INSERT INTO users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING RETURNING id")
            .bind(&email)
            .bind(&hash)
            .fetch_optional(&state.db)
            .await?;
    let (user_id,) = inserted.ok_or(ApiError::EmailTaken)?;
    Ok(Json(open_session(&state, user_id, &name).await?))
}

pub async fn login(State(state): State<AppState>, Json(input): Json<Credentials>) -> ApiResult<Json<SessionOut>> {
    let email = normalize_email(&input.email)?;
    let name = device_name(&input.device_name)?;
    state.limits.check_login(&email)?;
    let row: Option<(i64, String)> = sqlx::query_as("SELECT id, password_hash FROM users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&state.db)
        .await?;
    let user = match row {
        Some((id, hash)) => password_matches(input.password, hash).await?.then_some(id),
        None => None,
    };
    let Some(user) = user else {
        state.limits.login_failed(&email);
        return Err(ApiError::BadCredentials);
    };
    state.limits.login_succeeded(&email);
    Ok(Json(open_session(&state, user, &name).await?))
}

pub async fn logout(State(state): State<AppState>, session: Session) -> ApiResult<Json<()>> {
    sqlx::query("DELETE FROM devices WHERE id = $1").bind(&session.device_id).execute(&state.db).await?;
    state.limits.forget_token(&session.token_hash);
    Ok(Json(()))
}

/// Удаление аккаунта со всеми записями. Пароль спрашивается ещё раз, одного токена мало.
pub async fn delete_account(State(state): State<AppState>, session: Session, Json(input): Json<PasswordIn>) -> ApiResult<Json<()>> {
    let (hash,): (String,) = sqlx::query_as("SELECT password_hash FROM users WHERE id = $1")
        .bind(session.user_id)
        .fetch_one(&state.db)
        .await?;
    if !password_matches(input.password, hash).await? {
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
             WHERE s.token_hash = $1 AND d.id = s.device_id RETURNING s.user_id, s.device_id",
        )
        .bind(&token_hash)
        .fetch_optional(&state.db)
        .await?;
        let (user_id, device_id) = row.ok_or(ApiError::Unauthorized)?;
        Ok(Self { user_id, device_id, token_hash })
    }
}

#[derive(Default)]
struct LimitsInner {
    failed: std::collections::HashMap<String, (u32, Instant)>,
    rate: std::collections::HashMap<String, (Instant, u32)>,
}

/// Ограничения в памяти процесса: пауза после неудачных входов и частота запросов на токен.
#[derive(Default)]
pub struct Limits(std::sync::Mutex<LimitsInner>);

impl Limits {
    fn with<T>(&self, f: impl FnOnce(&mut LimitsInner) -> T) -> T {
        let mut guard = match self.0.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        f(&mut guard)
    }

    fn check_login(&self, email: &str) -> ApiResult<()> {
        self.with(|l| match l.failed.get(email) {
            Some((count, last)) if *count >= MAX_FAILED_LOGINS && last.elapsed() < LOGIN_PAUSE => Err(ApiError::TooManyAttempts),
            _ => Ok(()),
        })
    }

    fn login_failed(&self, email: &str) {
        self.with(|l| {
            let entry = l.failed.entry(email.to_owned()).or_insert((0, Instant::now()));
            if entry.1.elapsed() >= LOGIN_PAUSE {
                entry.0 = 0;
            }
            entry.0 += 1;
            entry.1 = Instant::now();
        });
    }

    fn login_succeeded(&self, email: &str) {
        self.with(|l| l.failed.remove(email));
    }

    fn forget_token(&self, token_hash: &str) {
        self.with(|l| l.rate.remove(token_hash));
    }

    fn check_rate(&self, token_hash: &str) -> ApiResult<()> {
        self.with(|l| {
            if l.rate.len() > 10_000 {
                l.rate.retain(|_, (start, _)| start.elapsed() < Duration::from_secs(1));
            }
            let entry = l.rate.entry(token_hash.to_owned()).or_insert((Instant::now(), 0));
            if entry.0.elapsed() >= Duration::from_secs(1) {
                *entry = (Instant::now(), 0);
            }
            entry.1 += 1;
            if entry.1 > REQUESTS_PER_SECOND { Err(ApiError::TooManyAttempts) } else { Ok(()) }
        })
    }
}

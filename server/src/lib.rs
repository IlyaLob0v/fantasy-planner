//! Сервер синхронизации «Штаба гильдии»: аккаунты и пересылка записей между устройствами.
//! Правил игры здесь нет: запись хранится как JSON, сливается по времени правки (см. specs/sync.md).

pub mod auth;
pub mod error;
pub mod sync;

use std::sync::Arc;

use axum::Router;
use axum::routing::{delete, get, post};
use sqlx::PgPool;
use tokio::sync::{OnceCell, Semaphore};
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::trace::TraceLayer;

const BODY_LIMIT: usize = 1024 * 1024;

/// Сколько проверок Argon2 идёт одновременно: каждая берёт около 19 МБ памяти.
const ARGON_SLOTS: usize = 4;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub limits: Arc<auth::Limits>,
    pub argon: Arc<Semaphore>,
    pub decoy: Arc<OnceCell<String>>,
    /// Сервер стоит за своим обратным прокси, и адрес клиента берётся из `X-Forwarded-For`.
    pub trust_proxy: bool,
}

#[derive(Default)]
pub struct Config {
    pub trust_proxy: bool,
}

pub fn app(db: PgPool) -> Router {
    app_with(db, Config::default())
}

pub fn app_with(db: PgPool, config: Config) -> Router {
    let state = AppState {
        db,
        limits: Arc::new(auth::Limits::default()),
        argon: Arc::new(Semaphore::new(ARGON_SLOTS)),
        decoy: Arc::new(OnceCell::new()),
        trust_proxy: config.trust_proxy,
    };
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/v1/auth/register", post(auth::register))
        .route("/v1/auth/login", post(auth::login))
        .route("/v1/auth/logout", post(auth::logout))
        .route("/v1/auth/password", post(auth::change_password))
        .route("/v1/account", delete(auth::delete_account))
        .route("/v1/sync/push", post(sync::push))
        .route("/v1/sync/pull", get(sync::pull))
        .route("/v1/sync/info", get(sync::info))
        .route("/v1/sync/replace", post(sync::replace))
        .layer(RequestBodyLimitLayer::new(BODY_LIMIT))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

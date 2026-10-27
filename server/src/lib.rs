//! Сервер синхронизации «Штаба гильдии»: аккаунты и пересылка записей между устройствами.
//! Правил игры здесь нет: запись хранится как JSON, сливается по времени правки (см. specs/sync.md).

pub mod auth;
pub mod error;
pub mod sync;

use std::sync::Arc;

use axum::Router;
use axum::routing::{delete, get, post};
use sqlx::PgPool;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::trace::TraceLayer;

const BODY_LIMIT: usize = 1024 * 1024;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub limits: Arc<auth::Limits>,
}

pub fn app(db: PgPool) -> Router {
    let state = AppState { db, limits: Arc::new(auth::Limits::default()) };
    Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/v1/auth/register", post(auth::register))
        .route("/v1/auth/login", post(auth::login))
        .route("/v1/auth/logout", post(auth::logout))
        .route("/v1/account", delete(auth::delete_account))
        .route("/v1/sync/push", post(sync::push))
        .route("/v1/sync/pull", get(sync::pull))
        .layer(RequestBodyLimitLayer::new(BODY_LIMIT))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

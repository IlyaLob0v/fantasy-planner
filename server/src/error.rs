use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;

/// Ошибка API. Клиент получает `{ kind, message }`, как и от Rust-команд приложения.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("Неверный e-mail или пароль")]
    BadCredentials,
    #[error("Слишком много попыток, подожди минуту")]
    TooManyAttempts,
    #[error("Этот e-mail уже занят")]
    EmailTaken,
    #[error("Нужно войти заново")]
    Unauthorized,
    #[error("{0}")]
    Invalid(String),
    #[error("Сервер летописи недоступен")]
    Internal(String),
}

impl ApiError {
    fn kind(&self) -> &'static str {
        match self {
            Self::BadCredentials => "bad_credentials",
            Self::TooManyAttempts => "too_many_attempts",
            Self::EmailTaken => "email_taken",
            Self::Unauthorized => "unauthorized",
            Self::Invalid(_) => "invalid",
            Self::Internal(_) => "internal",
        }
    }

    fn status(&self) -> StatusCode {
        match self {
            Self::BadCredentials | Self::Unauthorized => StatusCode::UNAUTHORIZED,
            Self::TooManyAttempts => StatusCode::TOO_MANY_REQUESTS,
            Self::EmailTaken => StatusCode::CONFLICT,
            Self::Invalid(_) => StatusCode::UNPROCESSABLE_ENTITY,
            Self::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }
}

#[derive(Serialize)]
struct Body<'a> {
    kind: &'a str,
    message: String,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        if let Self::Internal(detail) = &self {
            tracing::error!("{detail}");
        }
        let body = Body { kind: self.kind(), message: self.to_string() };
        (self.status(), Json(body)).into_response()
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(err: sqlx::Error) -> Self {
        Self::Internal(format!("база: {err}"))
    }
}

pub type ApiResult<T> = Result<T, ApiError>;

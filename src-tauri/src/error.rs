use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("ошибка базы данных: {0}")]
    Db(#[from] sqlx::Error),
    #[error("ошибка миграции: {0}")]
    Migrate(#[from] sqlx::migrate::MigrateError),
    #[error("ошибка файловой системы: {0}")]
    Io(#[from] std::io::Error),
    #[error("ошибка Tauri: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("не найдено: {0}")]
    NotFound(String),
    #[error("неверные данные: {0}")]
    Invalid(String),
    /// Сверка с сервером не удалась; текст уже в стиле мира.
    #[error("{0}")]
    Sync(String),
    #[error("Гильдейская почта просит войти заново")]
    SignedOut,
}

impl AppError {
    fn kind(&self) -> &'static str {
        match self {
            AppError::Db(_) => "db",
            AppError::Migrate(_) => "migrate",
            AppError::Io(_) => "io",
            AppError::Tauri(_) => "tauri",
            AppError::NotFound(_) => "not_found",
            AppError::Invalid(_) => "invalid",
            AppError::Sync(_) => "sync",
            AppError::SignedOut => "signed_out",
        }
    }
}

#[derive(Serialize)]
struct SerializedError<'a> {
    kind: &'a str,
    message: String,
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        SerializedError { kind: self.kind(), message: self.to_string() }.serialize(serializer)
    }
}

pub type AppResult<T> = Result<T, AppError>;

use std::process::ExitCode;

use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;

async fn run() -> Result<(), String> {
    let database_url = std::env::var("DATABASE_URL").map_err(|_| "не задан DATABASE_URL".to_owned())?;
    let bind = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8080".to_owned());
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await
        .map_err(|e| format!("не удалось подключиться к базе: {e}"))?;
    guild_sync::MIGRATOR.run(&db).await.map_err(|e| format!("миграции: {e}"))?;
    let listener = tokio::net::TcpListener::bind(&bind).await.map_err(|e| format!("порт {bind}: {e}"))?;
    tracing::info!("сервер летописи слушает {bind}");
    axum::serve(listener, guild_sync::app(db))
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .map_err(|e| format!("сервер: {e}"))
}

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt().with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))).init();
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            tracing::error!("{e}");
            ExitCode::FAILURE
        }
    }
}

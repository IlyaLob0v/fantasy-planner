//! HTTP к серверу гильдии (server/, протокол в specs/sync.md, раздел 3).

use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use super::records::Change;
use crate::error::{AppError, AppResult};

#[derive(Deserialize)]
pub struct SessionOut {
    pub token: String,
    pub device_id: String,
}

#[derive(Deserialize)]
pub struct InfoOut {
    pub epoch: i64,
    pub records: i64,
}

#[derive(Deserialize)]
pub struct EpochOut {
    pub epoch: i64,
}

#[derive(Deserialize)]
pub struct PullOut {
    pub changes: Vec<Change>,
    pub cursor: i64,
    pub more: bool,
    pub epoch: i64,
}

#[derive(Serialize)]
struct Credentials<'a> {
    email: &'a str,
    password: &'a str,
    device_name: &'a str,
}

#[derive(Serialize)]
struct PushIn<'a> {
    epoch: i64,
    changes: &'a [Change],
}

#[derive(Deserialize)]
struct ErrorOut {
    kind: String,
    message: String,
}

/// Ответ сервера, который движок обрабатывает сам, а не показывает.
pub enum Refusal {
    /// Героя аккаунта заменили с другого устройства.
    StaleEpoch,
    Other(AppError),
}

impl From<AppError> for Refusal {
    fn from(e: AppError) -> Self {
        Refusal::Other(e)
    }
}

pub struct Client {
    http: reqwest::Client,
    base: String,
    token: Option<String>,
}

/// Адрес штаба как его ввёл человек: без схемы считается http (тестовый сервер в домашней сети).
pub fn normalize_server(raw: &str) -> AppResult<String> {
    let trimmed = raw.trim().trim_end_matches('/');
    if trimmed.is_empty() || trimmed.contains(char::is_whitespace) {
        return Err(AppError::Sync("Нужен адрес штаба гильдии, например http://192.168.1.10:8080".into()));
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        Ok(trimmed.to_owned())
    } else {
        Ok(format!("http://{trimmed}"))
    }
}

fn unreachable(_: reqwest::Error) -> AppError {
    AppError::Sync("Штаб гильдии не отвечает. Проверь адрес и что сервер включён и в той же сети".into())
}

impl Client {
    pub fn new(base: &str, token: Option<String>) -> AppResult<Self> {
        let http = reqwest::Client::builder()
            .connect_timeout(Duration::from_secs(5))
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(unreachable)?;
        Ok(Self { http, base: normalize_server(base)?, token })
    }

    async fn send<T: DeserializeOwned>(&self, request: reqwest::RequestBuilder) -> Result<T, Refusal> {
        let request = match &self.token {
            Some(token) => request.bearer_auth(token),
            None => request,
        };
        let response = request.send().await.map_err(unreachable)?;
        let status = response.status();
        if status.is_success() {
            return response.json::<T>().await.map_err(|_| Refusal::Other(AppError::Sync("Штаб ответил непонятно".into())));
        }
        let error = response.json::<ErrorOut>().await.ok();
        Err(match error {
            Some(e) if e.kind == "stale_epoch" => Refusal::StaleEpoch,
            Some(e) if e.kind == "unauthorized" => Refusal::Other(AppError::SignedOut),
            Some(e) => Refusal::Other(AppError::Sync(e.message)),
            None => Refusal::Other(AppError::Sync(format!("Штаб ответил ошибкой {}", status.as_u16()))),
        })
    }

    fn url(&self, path: &str) -> String {
        format!("{}{path}", self.base)
    }

    pub async fn sign_in(&self, create: bool, email: &str, password: &str, device_name: &str) -> AppResult<SessionOut> {
        let path = if create { "/v1/auth/register" } else { "/v1/auth/login" };
        let body = Credentials { email, password, device_name };
        plain(self.send(self.http.post(self.url(path)).json(&body)).await)
    }

    pub async fn sign_out(&self) -> AppResult<()> {
        plain(self.send::<()>(self.http.post(self.url("/v1/auth/logout"))).await)
    }

    pub async fn info(&self) -> AppResult<InfoOut> {
        plain(self.send(self.http.get(self.url("/v1/sync/info"))).await)
    }

    pub async fn replace(&self) -> AppResult<EpochOut> {
        plain(self.send(self.http.post(self.url("/v1/sync/replace"))).await)
    }

    pub async fn push(&self, epoch: i64, changes: &[Change]) -> Result<(), Refusal> {
        #[derive(Deserialize)]
        struct Accepted {}
        self.send::<Accepted>(self.http.post(self.url("/v1/sync/push")).json(&PushIn { epoch, changes })).await.map(|_| ())
    }

    pub async fn pull(&self, after: i64) -> AppResult<PullOut> {
        plain(self.send(self.http.get(self.url("/v1/sync/pull")).query(&[("after", after)])).await)
    }
}

fn plain<T>(result: Result<T, Refusal>) -> AppResult<T> {
    result.map_err(|r| match r {
        Refusal::StaleEpoch => AppError::Sync("Летопись аккаунта заменили с другого устройства".into()),
        Refusal::Other(e) => e,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_address_gets_a_scheme() -> AppResult<()> {
        assert_eq!(normalize_server(" 192.168.1.10:8080/ ")?, "http://192.168.1.10:8080");
        assert_eq!(normalize_server("https://guild.example.ru")?, "https://guild.example.ru");
        assert!(normalize_server("").is_err());
        Ok(())
    }
}

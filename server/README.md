# Сервер синхронизации

Аккаунты и пересылка записей между устройствами «Штаба гильдии». Правил игры сервер не знает: запись хранится как JSON и сливается по времени правки. Устройство и протокол описаны в [specs/sync.md](../specs/sync.md).

## Тестовый сервер на своём компьютере (Windows)

1. Поставь [Docker Desktop](https://www.docker.com/products/docker-desktop/) и запусти его.
2. Скачай репозиторий (зелёная кнопка **Code → Download ZIP** на GitHub) и распакуй.
3. Открой PowerShell в папке `server` и выполни:

   ```powershell
   docker compose up -d --build
   ```

   Первая сборка идёт несколько минут. Проверка: в браузере открой <http://localhost:8080/health>, должно появиться `ok`.
4. Узнай адрес компьютера в Wi-Fi: `ipconfig`, строка **IPv4-адрес** (например, `192.168.1.23`). Телефон будет подключаться к `http://192.168.1.23:8080`.
5. Первый раз Windows спросит про доступ Docker к сети: разреши для **частных сетей**.

Остановить: `docker compose down`. Данные лежат в томе `guild-db` и переживают перезапуск. Стереть всё: `docker compose down -v`.

Пока компьютер выключен, приложение работает как обычно и копит изменения, а сверка пройдёт при следующем подключении.

## Разработка

Нужны Rust 1.94+ и Postgres 16.

```bash
export DATABASE_URL=postgres://postgres@localhost:5432/postgres
cargo clippy --all-targets -- -D warnings
cargo test      # каждый тест создаёт себе чистую базу
cargo run       # BIND_ADDR по умолчанию 0.0.0.0:8080
```

## API

| Запрос | Что делает |
|---|---|
| `POST /v1/auth/register` `{email, password, device_name}` | Новый аккаунт, ответ `{token, device_id}` |
| `POST /v1/auth/login` `{email, password, device_name}` | Вход нового устройства; после 5 неудач пауза минуту |
| `POST /v1/auth/logout` | Отзывает токен этого устройства |
| `DELETE /v1/account` `{password}` | Удаляет аккаунт и все записи |
| `POST /v1/sync/push` `{changes: [{table, uid, updated_at, data}]}` | До 1000 записей, ответ `{accepted}` |
| `GET /v1/sync/pull?after=N` | До 500 записей после курсора, ответ `{changes, cursor, more}` |

Токен передаётся в `Authorization: Bearer <токен>`, не больше 10 запросов в секунду. Ошибки приходят как `{kind, message}`.

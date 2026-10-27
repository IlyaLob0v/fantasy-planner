-- Аккаунты, устройства, сессии и копия записей клиентов.
-- Сервер не знает схему игры: запись хранится как непрозрачный JSON с меткой времени правки.

CREATE TABLE users (
    id              BIGSERIAL   PRIMARY KEY,
    email           TEXT        NOT NULL UNIQUE,         -- в нижнем регистре
    password_hash   TEXT        NOT NULL,                -- Argon2id, формат PHC
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
    id              TEXT        PRIMARY KEY,             -- UUID, выдаёт сервер при входе
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_user ON devices(user_id);

CREATE TABLE sessions (
    token_hash      TEXT        PRIMARY KEY,             -- SHA-256 токена; сам токен знает только устройство
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       TEXT        NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Номер изменения общий для всех, порядок внутри аккаунта держит блокировка строки users при записи.
CREATE SEQUENCE record_seq;

CREATE TABLE records (
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tbl             TEXT        NOT NULL,
    uid             TEXT        NOT NULL,
    updated_at      TEXT        NOT NULL,                -- ISO-8601 UTC с миллисекундами, как на устройстве
    device_id       TEXT        NOT NULL,
    data            JSONB       NOT NULL,
    seq             BIGINT      NOT NULL DEFAULT nextval('record_seq'),
    PRIMARY KEY (user_id, tbl, uid)
);
CREATE INDEX idx_records_seq ON records(user_id, seq);

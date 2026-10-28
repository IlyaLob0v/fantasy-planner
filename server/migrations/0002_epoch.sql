-- Эпоха летописи: растёт, когда устройство заменяет героя аккаунта своим.
-- Устройство со старой эпохой не может отправлять записи и принимает героя заново.
ALTER TABLE users ADD COLUMN epoch BIGINT NOT NULL DEFAULT 1;

-- Прежняя летопись после замены хранится 30 дней: вдруг заменили не того героя.
CREATE TABLE records_archive (
    user_id         BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    epoch           BIGINT      NOT NULL,
    tbl             TEXT        NOT NULL,
    uid             TEXT        NOT NULL,
    updated_at      TEXT        NOT NULL,
    device_id       TEXT        NOT NULL,
    data            JSONB       NOT NULL,
    archived_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_records_archive_user ON records_archive(user_id, archived_at);

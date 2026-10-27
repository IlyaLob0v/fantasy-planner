-- V0.7 «Будни странника», часть 1: комната в таверне.
-- Сутки с start_date по end_date включительно нейтральны для серии: без дел они её не растят и не рвут.
-- «Вернуться раньше» укорачивает end_date или ставит deleted_at, если комната ещё не началась.
-- Номер 0007 оставлен за синхронизацией.
CREATE TABLE inn_stays (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uid             TEXT    NOT NULL UNIQUE,
    start_date      TEXT    NOT NULL,
    end_date        TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at      TEXT,
    CHECK (end_date >= start_date)
);
CREATE INDEX idx_inn_stays_end ON inn_stays(end_date) WHERE deleted_at IS NULL;

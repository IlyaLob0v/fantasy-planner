-- V0.6 «Дорога домой», часть 3: Сказ о герое.
-- Тексты глав живут в коде (src/domain/saga.ts) по стабильным ключам, здесь только факт открытия и прочтения.
-- Глава открывается по дням в походе и не отбирается никогда.
CREATE TABLE saga_chapters (
    key             TEXT    PRIMARY KEY,
    uid             TEXT    NOT NULL UNIQUE,
    unlocked_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    read_at         TEXT,
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO settings (key, value) VALUES
    ('saga_every_days', '5');

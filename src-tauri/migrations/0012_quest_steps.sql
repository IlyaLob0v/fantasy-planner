-- V0.7 «Будни странника», часть 2: чек-лист в квесте и метки.
-- Пункт чек-листа сам награды не даёт: награда квеста растёт за отмеченные пункты (считается в TS).
-- Удаление пункта мягкое (deleted_at), чтобы его можно было переслать при синхронизации.
CREATE TABLE quest_steps (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uid             TEXT    NOT NULL UNIQUE,
    quest_id        INTEGER NOT NULL REFERENCES quests(id) ON DELETE CASCADE,
    title           TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    done_at         TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    deleted_at      TEXT
);
CREATE INDEX idx_quest_steps_quest ON quest_steps(quest_id) WHERE deleted_at IS NULL;

-- Одна необязательная метка квеста: «Работа», «Дом», «Учёба». Фильтр на доске.
ALTER TABLE quests ADD COLUMN label TEXT CHECK (label IS NULL OR length(label) BETWEEN 1 AND 40);

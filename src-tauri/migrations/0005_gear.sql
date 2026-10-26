-- V0.5 «Слава и снаряжение», часть 3: снаряжение, находки и кузнец.

-- Найденные и купленные предметы. Каталог живёт в коде (src/domain/gear.ts), здесь факт владения.
-- Дублей нет: один предмет каталога — одна строка. Отмена дела удаляет находку этого дела.
CREATE TABLE gear (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uid             TEXT    NOT NULL UNIQUE,
    item_key        TEXT    NOT NULL UNIQUE,
    source_type     TEXT    NOT NULL CHECK (source_type IN ('quest','ritual','boss','achievement','forge','week_chest')),
    source_id       INTEGER,
    game_date       TEXT    NOT NULL,
    -- Сколько дел подряд было без находки до этой: отмена возвращает счётчик невезения.
    misses_before   INTEGER NOT NULL DEFAULT 0 CHECK (misses_before >= 0),
    obtained_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_gear_source ON gear(source_type, source_id, game_date);

-- Что надето. Пять слотов, пустой слот — NULL. Слот сам служит ключом синхронизации.
CREATE TABLE equipment (
    slot            TEXT    PRIMARY KEY CHECK (slot IN ('weapon','helm','armor','cloak','talisman')),
    gear_id         INTEGER REFERENCES gear(id) ON DELETE SET NULL,
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO equipment (slot) VALUES ('weapon'), ('helm'), ('armor'), ('cloak'), ('talisman');

-- Счётчик невезения: дела подряд без находки. Кэш, как и остальные поля персонажа.
ALTER TABLE character ADD COLUMN loot_misses INTEGER NOT NULL DEFAULT 0 CHECK (loot_misses >= 0);

INSERT INTO settings (key, value) VALUES
    ('loot', '{"base_pct":12,"step_pct":4,"pity":15,"daily_cap":2,"weights":{"common":60,"rare":28,"epic":10,"legendary":2},"unlock_level":{"common":1,"rare":5,"epic":10,"legendary":15}}'),
    ('forge_prices', '{"common":60,"rare":150}');

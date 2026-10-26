-- V0.5 «Слава и снаряжение», часть 4: неделя гильдии и герб.

-- Цели недели. Каталог целей живёт в коде (src/domain/week.ts), прогресс считается из журнала и хроники.
-- Неделя начинается в понедельник игровых суток. Невыполненная цель просто остаётся в прошлом.
CREATE TABLE week_goals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uid             TEXT    NOT NULL UNIQUE,
    week_start      TEXT    NOT NULL,
    goal_key        TEXT    NOT NULL,
    target          INTEGER NOT NULL CHECK (target > 0),
    state           TEXT    NOT NULL DEFAULT 'active' CHECK (state IN ('active','done','off')),
    completed_at    TEXT,
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    UNIQUE (week_start, goal_key)
);

-- Купленные части герба. Части по умолчанию бесплатны и сюда не пишутся.
CREATE TABLE crest_parts (
    key             TEXT    PRIMARY KEY,
    uid             TEXT    NOT NULL UNIQUE,
    bought_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

INSERT INTO settings (key, value) VALUES
    ('week', '{"goal_gold":20,"chest_gold":60,"stretch_pct":10}'),
    ('recap_seen', '""'),
    ('crest', '{"shield":"heater","charge":"tower","tincture":"burgundy"}'),
    ('crest_price', '40');

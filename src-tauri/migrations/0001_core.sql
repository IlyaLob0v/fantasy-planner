-- V0.1 «Первый дозор»: ядро. См. specs/schema.md.
-- Персонаж: ровно одна запись (id = 1).
-- level/xp/gold/атрибуты: кэш, который всегда можно пересчитать из ledger.
CREATE TABLE character (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    name            TEXT    NOT NULL,
    title           TEXT,                              -- «Страж Восточной башни», меняется с уровнем
    level           INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
    xp              INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),       -- всего накоплено
    gold            INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
    strength        INTEGER NOT NULL DEFAULT 0,
    intellect       INTEGER NOT NULL DEFAULT 0,
    agility         INTEGER NOT NULL DEFAULT 0,
    streak_current  INTEGER NOT NULL DEFAULT 0,
    streak_best     INTEGER NOT NULL DEFAULT 0,
    wind_step       INTEGER NOT NULL DEFAULT 0 CHECK (wind_step BETWEEN 0 AND 3), -- ступень бонуса серии
    fatigued_since  TEXT,                              -- дата пропуска; NULL = бодр
    location_key    TEXT    NOT NULL DEFAULT 'gatehouse',
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Квесты. Этапы босса — это тоже квесты с parent_id (как в ядре).
CREATE TABLE quests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id       INTEGER REFERENCES quests(id) ON DELETE CASCADE,
    type            TEXT    NOT NULL CHECK (type IN ('main','side','boss','stage')),
    title           TEXT    NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
    description     TEXT,
    attribute       TEXT    NOT NULL CHECK (attribute IN ('strength','intellect','agility')),
    difficulty      INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
    status          TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','done')),
    scheduled_date  TEXT,                              -- на какой день взят; NULL = на доске без даты
    due_date        TEXT,                              -- дедлайн (Main, Boss)
    damage          INTEGER NOT NULL DEFAULT 1 CHECK (damage >= 1), -- только для 'stage': урон боссу
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    completed_at    TEXT,
    archived_at     TEXT,
    CHECK ((type = 'stage') = (parent_id IS NOT NULL)),
    CHECK ((status = 'done') = (completed_at IS NOT NULL))
);
CREATE INDEX idx_quests_scheduled ON quests(scheduled_date) WHERE archived_at IS NULL;
CREATE INDEX idx_quests_parent    ON quests(parent_id);

-- Журнал наград: единственный источник истины для XP, золота и атрибутов.
-- Отмена выполнения — новая строка с обратными знаками, а не удаление.
CREATE TABLE ledger (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    game_date       TEXT    NOT NULL,
    source_type     TEXT    NOT NULL CHECK (source_type IN
                        ('quest','boss_defeat','ritual','rest_action','purchase','rest','revert')),
    source_id       INTEGER,
    xp_delta        INTEGER NOT NULL DEFAULT 0,
    gold_delta      INTEGER NOT NULL DEFAULT 0,
    attribute       TEXT    CHECK (attribute IN ('strength','intellect','agility')),
    attribute_delta INTEGER NOT NULL DEFAULT 0,
    reverts_id      INTEGER REFERENCES ledger(id),
    note            TEXT
);
CREATE INDEX idx_ledger_date ON ledger(game_date);

-- Игровые сутки: основа серии и усталости.
CREATE TABLE days (
    game_date       TEXT    PRIMARY KEY,
    kind            TEXT    NOT NULL DEFAULT 'normal' CHECK (kind IN ('normal','rest')),
    deeds_count     INTEGER NOT NULL DEFAULT 0,        -- выполненные квесты + ритуалы
    closed_at       TEXT                               -- когда день подведён (при первом запуске следующего)
);

-- Инвентарь: всё, чем владеет персонаж.
CREATE TABLE inventory (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    item_type         TEXT NOT NULL CHECK (item_type IN ('loot','reward','location')),
    item_name         TEXT NOT NULL,
    rarity            TEXT NOT NULL DEFAULT 'common'
                           CHECK (rarity IN ('common','rare','epic','legendary')),
    asset_key         TEXT,                            -- ключ в реестре ассетов, не путь к файлу
    source_type       TEXT CHECK (source_type IN ('boss','purchase','level')),
    source_id         INTEGER,
    obtained_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    redeemed_at       TEXT                             -- для реальных наград: «использовано»
);

-- Микро-действия для привала при усталости (твой список, редактируется в настройках).
-- Сидируется: «Выпить стакан воды», «Пройтись 5 минут», «Проветрить комнату», «Три глубоких вдоха у окна».
CREATE TABLE rest_actions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,                  -- «Выпить воды», «Пройтись 5 минут»
    archived_at     TEXT
);

-- Настройки: ключ → JSON-значение.
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL CHECK (json_valid(value))
);

INSERT INTO character (id, name, title) VALUES (1, 'Странник', 'Странник');

INSERT INTO rest_actions (title) VALUES
    ('Выпить стакан воды'),
    ('Пройтись 5 минут'),
    ('Проветрить комнату'),
    ('Три глубоких вдоха у окна');

INSERT INTO settings (key, value) VALUES
    ('day_start_hour', '4'),
    ('rates', '{"side":{"xp":10,"gold":3},"main":{"xp":30,"gold":10},"stage":{"xp":15,"gold":4},"boss_defeat":{"xp":60,"gold":25},"ritual":{"xp":5,"gold":2},"rest_action":{"xp":3,"gold":0}}'),
    ('streak_bonus', '{"step_days":7,"step_pct":10,"max_pct":30,"on_miss":"drop_one_step"}'),
    ('level_curve', '{"base":50,"exp":1.4,"round":5}'),
    ('rest_price', '40'),
    ('sound_enabled', 'false'),
    ('motion', '"full"');

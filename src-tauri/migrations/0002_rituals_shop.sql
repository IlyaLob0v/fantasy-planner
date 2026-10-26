-- V0.2 «Обеты и казна»: ритуалы и лавка. См. specs/schema.md.
CREATE TABLE rituals (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,                  -- «Утренняя молитва»
    real_name       TEXT,                              -- «зарядка», мелкий подзаголовок
    attribute       TEXT    NOT NULL CHECK (attribute IN ('strength','intellect','agility')),
    schedule        TEXT    NOT NULL DEFAULT 'daily'
                    CHECK (schedule IN ('daily','weekdays','times_per_week','every_n_days')),
    weekdays_mask   INTEGER CHECK (weekdays_mask BETWEEN 1 AND 127), -- бит 0 = пн
    times_per_week  INTEGER CHECK (times_per_week BETWEEN 1 AND 7),
    interval_days   INTEGER CHECK (interval_days BETWEEN 2 AND 365),
    start_date      TEXT    NOT NULL,                  -- отсчёт для every_n_days
    paused_until    TEXT,                              -- пауза без потери истории
    difficulty      INTEGER NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    archived_at     TEXT,
    CHECK ((schedule = 'weekdays')       = (weekdays_mask  IS NOT NULL)),
    CHECK ((schedule = 'times_per_week') = (times_per_week IS NOT NULL)),
    CHECK ((schedule = 'every_n_days')   = (interval_days  IS NOT NULL))
);

CREATE TABLE ritual_completions (
    ritual_id       INTEGER NOT NULL REFERENCES rituals(id),
    game_date       TEXT    NOT NULL,
    completed_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    PRIMARY KEY (ritual_id, game_date)
);

-- Каталог реальных наград, которые настраиваешь ты сам.
CREATE TABLE rewards (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT    NOT NULL,                  -- «Вечер в таверне» = поход в кино
    description     TEXT,
    price           INTEGER NOT NULL CHECK (price > 0),
    repeatable      INTEGER NOT NULL DEFAULT 1 CHECK (repeatable IN (0,1)),
    asset_key       TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    archived_at     TEXT
);

CREATE INDEX idx_ritual_completions_date ON ritual_completions(game_date);

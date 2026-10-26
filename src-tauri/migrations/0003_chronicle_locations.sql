-- V0.3 «Карта мира»: хроника дня и каталог локаций.

CREATE TABLE chronicle (
    game_date       TEXT    PRIMARY KEY,
    happened        TEXT    NOT NULL DEFAULT '',
    noticed         TEXT    NOT NULL DEFAULT '',
    feeling         TEXT    NOT NULL DEFAULT '',
    mood            INTEGER CHECK (mood BETWEEN 1 AND 5),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Каталог локаций. Владение хранится строкой в inventory (item_type = 'location', asset_key = key).
-- Надвратная башня бесплатна и открыта с первого уровня, поэтому считается своей без покупки.
CREATE TABLE locations (
    key             TEXT    PRIMARY KEY,
    name            TEXT    NOT NULL,
    asset_key       TEXT    NOT NULL,
    unlock_level    INTEGER NOT NULL DEFAULT 1 CHECK (unlock_level >= 1),
    price           INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
    sort_order      INTEGER NOT NULL DEFAULT 0
);

INSERT INTO locations (key, name, asset_key, unlock_level, price, sort_order) VALUES
    ('gatehouse',     'Надвратная башня',        'location.gatehouse',     1,  0,   0),
    ('forest',        'Сосновый бор',            'location.forest',        5,  120, 1),
    ('tavern',        'Таверна «Пьяный грифон»', 'location.tavern',        10, 250, 2),
    ('goblin_market', 'Гоблинский рынок',        'location.goblin_market', 15, 400, 3),
    ('dragon_lair',   'Логово дракона',          'location.dragon_lair',   20, 600, 4);

CREATE INDEX idx_inventory_source ON inventory(source_type, source_id);

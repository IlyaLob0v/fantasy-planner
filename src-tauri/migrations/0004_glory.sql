-- V0.5 «Слава и снаряжение», часть 2: Зал славы и Присяга гильдии.

-- Журнал получает источники V0.5: золото за достижения и сундук недели.
-- SQLite не меняет CHECK на месте, поэтому таблица пересобирается с теми же строками и id.
CREATE TABLE ledger_v5 (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    game_date       TEXT    NOT NULL,
    source_type     TEXT    NOT NULL CHECK (source_type IN
                        ('quest','boss_defeat','ritual','rest_action','purchase','rest','revert',
                         'achievement','week_chest')),
    source_id       INTEGER,
    xp_delta        INTEGER NOT NULL DEFAULT 0,
    gold_delta      INTEGER NOT NULL DEFAULT 0,
    attribute       TEXT    CHECK (attribute IN ('strength','intellect','agility')),
    attribute_delta INTEGER NOT NULL DEFAULT 0,
    reverts_id      INTEGER REFERENCES ledger_v5(id),
    note            TEXT
);

INSERT INTO ledger_v5 (id, occurred_at, game_date, source_type, source_id, xp_delta, gold_delta,
                       attribute, attribute_delta, reverts_id, note)
SELECT id, occurred_at, game_date, source_type, source_id, xp_delta, gold_delta,
       attribute, attribute_delta, reverts_id, note
FROM ledger ORDER BY id;

DROP TABLE ledger;
ALTER TABLE ledger_v5 RENAME TO ledger;
CREATE INDEX idx_ledger_date ON ledger(game_date);
CREATE INDEX idx_ledger_reverts ON ledger(reverts_id);

-- Открытые достижения. Определения и прогресс живут в коде (src/domain/achievements.ts),
-- здесь только факт открытия. Золото за достижение лежит в ledger (source_type = 'achievement', note = key).
-- Достижение не отбирается: строка не удаляется никогда.
CREATE TABLE achievements (
    key             TEXT    PRIMARY KEY,
    uid             TEXT    NOT NULL UNIQUE,
    unlocked_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Присяга гильдии показывается только новому герою: у того, кто уже что-то сделал, её нет.
INSERT INTO settings (key, value)
SELECT 'oath_done', CASE WHEN EXISTS (SELECT 1 FROM ledger) THEN 'true' ELSE 'false' END;

-- Подсказки «один раз»: ключи уже показанных.
INSERT INTO settings (key, value) VALUES ('hints_seen', '[]');

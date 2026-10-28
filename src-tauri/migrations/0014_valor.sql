-- V0.7 «Будни странника», часть 4: доблести.
-- Счётчик без расписания: клик даёт малую награду, но не считается делом дня.
-- Отметка доблести лежит только в журнале (source_type = 'valor', source_id = id доблести),
-- отмена пишется обратной строкой, как у остальных источников.

CREATE TABLE valors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    uid             TEXT,
    title           TEXT    NOT NULL,                  -- «Глоток из родника»
    real_name       TEXT,                              -- «выпил стакан воды»
    attribute       TEXT    NOT NULL CHECK (attribute IN ('strength','intellect','agility')),
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    archived_at     TEXT
);
CREATE UNIQUE INDEX idx_valors_uid ON valors(uid);

-- Журнал получает источник 'valor'. SQLite не меняет CHECK на месте, поэтому таблица пересобирается
-- с теми же строками и id. Столбец uid и триггер журнала исходящих из 0007 переносятся вместе с ней.
CREATE TABLE ledger_v14 (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    game_date       TEXT    NOT NULL,
    source_type     TEXT    NOT NULL CHECK (source_type IN
                        ('quest','boss_defeat','ritual','rest_action','purchase','rest','revert',
                         'achievement','week_chest','valor')),
    source_id       INTEGER,
    xp_delta        INTEGER NOT NULL DEFAULT 0,
    gold_delta      INTEGER NOT NULL DEFAULT 0,
    attribute       TEXT    CHECK (attribute IN ('strength','intellect','agility')),
    attribute_delta INTEGER NOT NULL DEFAULT 0,
    reverts_id      INTEGER REFERENCES ledger_v14(id),
    note            TEXT,
    uid             TEXT
);

INSERT INTO ledger_v14 (id, occurred_at, game_date, source_type, source_id, xp_delta, gold_delta,
                        attribute, attribute_delta, reverts_id, note, uid)
SELECT id, occurred_at, game_date, source_type, source_id, xp_delta, gold_delta,
       attribute, attribute_delta, reverts_id, note, uid
FROM ledger ORDER BY id;

DROP TABLE ledger;
ALTER TABLE ledger_v14 RENAME TO ledger;
CREATE INDEX idx_ledger_date ON ledger(game_date);
CREATE INDEX idx_ledger_reverts ON ledger(reverts_id);
CREATE UNIQUE INDEX idx_ledger_uid ON ledger(uid);

CREATE TRIGGER ledger_sync_insert AFTER INSERT ON ledger BEGIN
    UPDATE ledger SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) WHERE rowid = NEW.rowid AND uid IS NULL;
    DELETE FROM sync_outbox WHERE tbl = 'ledger' AND key = (SELECT uid FROM ledger WHERE rowid = NEW.rowid);
    INSERT INTO sync_outbox (tbl, key, changed_at)
    SELECT 'ledger', uid, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM ledger WHERE rowid = NEW.rowid AND (SELECT applying FROM sync_flags) = 0;
END;

-- Синхронизация доблестей: те же триггеры журнала исходящих, что у ритуалов в 0007.
CREATE TRIGGER valors_sync_insert AFTER INSERT ON valors BEGIN
    UPDATE valors SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) WHERE rowid = NEW.rowid AND uid IS NULL;
    DELETE FROM sync_outbox WHERE tbl = 'valors' AND key = (SELECT uid FROM valors WHERE rowid = NEW.rowid);
    INSERT INTO sync_outbox (tbl, key, changed_at)
    SELECT 'valors', uid, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM valors WHERE rowid = NEW.rowid AND (SELECT applying FROM sync_flags) = 0;
END;
CREATE TRIGGER valors_sync_update AFTER UPDATE OF title, real_name, attribute, sort_order, archived_at ON valors
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.title IS NOT NEW.title OR OLD.real_name IS NOT NEW.real_name OR OLD.attribute IS NOT NEW.attribute OR OLD.sort_order IS NOT NEW.sort_order OR OLD.archived_at IS NOT NEW.archived_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'valors' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('valors', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- Ставка за отметку доблести (меняется в «Уставе»).
UPDATE settings SET value = json_set(value, '$.valor', json('{"xp":2,"gold":1}')) WHERE key = 'rates';

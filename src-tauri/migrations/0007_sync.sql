-- Синхронизация через свой сервер (specs/sync.md, разделы 1–2).
-- Ключи записей одинаковы на всех устройствах; триггеры отмечают изменённые ключи в журнале исходящих.

-- Записи без естественного ключа получают uid. Старым он выдаётся здесь, новым ставит триггер при вставке.

ALTER TABLE quests ADD COLUMN uid TEXT;
UPDATE quests SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)));
CREATE UNIQUE INDEX idx_quests_uid ON quests(uid);

ALTER TABLE ledger ADD COLUMN uid TEXT;
UPDATE ledger SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)));
CREATE UNIQUE INDEX idx_ledger_uid ON ledger(uid);

ALTER TABLE inventory ADD COLUMN uid TEXT;
UPDATE inventory SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)));
CREATE UNIQUE INDEX idx_inventory_uid ON inventory(uid);

ALTER TABLE rest_actions ADD COLUMN uid TEXT;
UPDATE rest_actions SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)));
CREATE UNIQUE INDEX idx_rest_actions_uid ON rest_actions(uid);

ALTER TABLE rituals ADD COLUMN uid TEXT;
UPDATE rituals SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)));
CREATE UNIQUE INDEX idx_rituals_uid ON rituals(uid);

ALTER TABLE rewards ADD COLUMN uid TEXT;
UPDATE rewards SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)));
CREATE UNIQUE INDEX idx_rewards_uid ON rewards(uid);

-- Какие ключи изменились на этом устройстве и когда. Время правки уходит на сервер как updated_at записи.
CREATE TABLE sync_outbox (
    tbl             TEXT    NOT NULL,
    key             TEXT    NOT NULL,
    changed_at      TEXT    NOT NULL,
    PRIMARY KEY (tbl, key)
);

-- Принятые записи, чья связь ещё не пришла (этап раньше своего босса). Применяются, когда связь появится.
CREATE TABLE sync_inbox (
    tbl             TEXT    NOT NULL,
    key             TEXT    NOT NULL,
    updated_at      TEXT    NOT NULL,
    data            TEXT    NOT NULL CHECK (json_valid(data)),
    PRIMARY KEY (tbl, key)
);

-- Пока устройство записывает принятое с сервера, applying = 1 и триггеры молчат.
CREATE TABLE sync_flags (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    applying        INTEGER NOT NULL DEFAULT 0 CHECK (applying IN (0, 1))
);
INSERT INTO sync_flags (id) VALUES (1);

-- Вход и курсор: адрес сервера, e-mail, имя устройства, device_id, токен, cursor, epoch, last_sync_at.
CREATE TABLE sync_state (
    key             TEXT    PRIMARY KEY,
    value           TEXT    NOT NULL
);

-- quests
CREATE TRIGGER quests_sync_insert AFTER INSERT ON quests BEGIN
    UPDATE quests SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) WHERE rowid = NEW.rowid AND uid IS NULL;
    DELETE FROM sync_outbox WHERE tbl = 'quests' AND key = (SELECT uid FROM quests WHERE rowid = NEW.rowid);
    INSERT INTO sync_outbox (tbl, key, changed_at)
    SELECT 'quests', uid, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM quests WHERE rowid = NEW.rowid AND (SELECT applying FROM sync_flags) = 0;
END;
CREATE TRIGGER quests_sync_update AFTER UPDATE OF parent_id, type, title, description, attribute, difficulty, status, scheduled_date, due_date, damage, sort_order, completed_at, archived_at ON quests
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.parent_id IS NOT NEW.parent_id OR OLD.type IS NOT NEW.type OR OLD.title IS NOT NEW.title OR OLD.description IS NOT NEW.description OR OLD.attribute IS NOT NEW.attribute OR OLD.difficulty IS NOT NEW.difficulty OR OLD.status IS NOT NEW.status OR OLD.scheduled_date IS NOT NEW.scheduled_date OR OLD.due_date IS NOT NEW.due_date OR OLD.damage IS NOT NEW.damage OR OLD.sort_order IS NOT NEW.sort_order OR OLD.completed_at IS NOT NEW.completed_at OR OLD.archived_at IS NOT NEW.archived_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'quests' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('quests', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- ledger
CREATE TRIGGER ledger_sync_insert AFTER INSERT ON ledger BEGIN
    UPDATE ledger SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) WHERE rowid = NEW.rowid AND uid IS NULL;
    DELETE FROM sync_outbox WHERE tbl = 'ledger' AND key = (SELECT uid FROM ledger WHERE rowid = NEW.rowid);
    INSERT INTO sync_outbox (tbl, key, changed_at)
    SELECT 'ledger', uid, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM ledger WHERE rowid = NEW.rowid AND (SELECT applying FROM sync_flags) = 0;
END;

-- inventory
CREATE TRIGGER inventory_sync_insert AFTER INSERT ON inventory BEGIN
    UPDATE inventory SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) WHERE rowid = NEW.rowid AND uid IS NULL;
    DELETE FROM sync_outbox WHERE tbl = 'inventory' AND key = (SELECT uid FROM inventory WHERE rowid = NEW.rowid);
    INSERT INTO sync_outbox (tbl, key, changed_at)
    SELECT 'inventory', uid, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM inventory WHERE rowid = NEW.rowid AND (SELECT applying FROM sync_flags) = 0;
END;
CREATE TRIGGER inventory_sync_update AFTER UPDATE OF item_name, rarity, asset_key, redeemed_at ON inventory
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.item_name IS NOT NEW.item_name OR OLD.rarity IS NOT NEW.rarity OR OLD.asset_key IS NOT NEW.asset_key OR OLD.redeemed_at IS NOT NEW.redeemed_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'inventory' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('inventory', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER inventory_sync_delete AFTER DELETE ON inventory WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'inventory' AND key = OLD.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('inventory', OLD.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- rest_actions
CREATE TRIGGER rest_actions_sync_insert AFTER INSERT ON rest_actions BEGIN
    UPDATE rest_actions SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) WHERE rowid = NEW.rowid AND uid IS NULL;
    DELETE FROM sync_outbox WHERE tbl = 'rest_actions' AND key = (SELECT uid FROM rest_actions WHERE rowid = NEW.rowid);
    INSERT INTO sync_outbox (tbl, key, changed_at)
    SELECT 'rest_actions', uid, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM rest_actions WHERE rowid = NEW.rowid AND (SELECT applying FROM sync_flags) = 0;
END;
CREATE TRIGGER rest_actions_sync_update AFTER UPDATE OF title, archived_at ON rest_actions
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.title IS NOT NEW.title OR OLD.archived_at IS NOT NEW.archived_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'rest_actions' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('rest_actions', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- rituals
CREATE TRIGGER rituals_sync_insert AFTER INSERT ON rituals BEGIN
    UPDATE rituals SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) WHERE rowid = NEW.rowid AND uid IS NULL;
    DELETE FROM sync_outbox WHERE tbl = 'rituals' AND key = (SELECT uid FROM rituals WHERE rowid = NEW.rowid);
    INSERT INTO sync_outbox (tbl, key, changed_at)
    SELECT 'rituals', uid, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM rituals WHERE rowid = NEW.rowid AND (SELECT applying FROM sync_flags) = 0;
END;
CREATE TRIGGER rituals_sync_update AFTER UPDATE OF title, real_name, attribute, schedule, weekdays_mask, times_per_week, interval_days, start_date, paused_until, difficulty, sort_order, archived_at ON rituals
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.title IS NOT NEW.title OR OLD.real_name IS NOT NEW.real_name OR OLD.attribute IS NOT NEW.attribute OR OLD.schedule IS NOT NEW.schedule OR OLD.weekdays_mask IS NOT NEW.weekdays_mask OR OLD.times_per_week IS NOT NEW.times_per_week OR OLD.interval_days IS NOT NEW.interval_days OR OLD.start_date IS NOT NEW.start_date OR OLD.paused_until IS NOT NEW.paused_until OR OLD.difficulty IS NOT NEW.difficulty OR OLD.sort_order IS NOT NEW.sort_order OR OLD.archived_at IS NOT NEW.archived_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'rituals' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('rituals', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- rewards
CREATE TRIGGER rewards_sync_insert AFTER INSERT ON rewards BEGIN
    UPDATE rewards SET uid = lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + abs(random()) % 4, 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6))) WHERE rowid = NEW.rowid AND uid IS NULL;
    DELETE FROM sync_outbox WHERE tbl = 'rewards' AND key = (SELECT uid FROM rewards WHERE rowid = NEW.rowid);
    INSERT INTO sync_outbox (tbl, key, changed_at)
    SELECT 'rewards', uid, strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM rewards WHERE rowid = NEW.rowid AND (SELECT applying FROM sync_flags) = 0;
END;
CREATE TRIGGER rewards_sync_update AFTER UPDATE OF title, description, price, repeatable, asset_key, archived_at ON rewards
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.title IS NOT NEW.title OR OLD.description IS NOT NEW.description OR OLD.price IS NOT NEW.price OR OLD.repeatable IS NOT NEW.repeatable OR OLD.asset_key IS NOT NEW.asset_key OR OLD.archived_at IS NOT NEW.archived_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'rewards' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('rewards', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- ritual_completions
CREATE TRIGGER ritual_completions_sync_insert AFTER INSERT ON ritual_completions WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'ritual_completions' AND key = (SELECT uid FROM rituals WHERE id = NEW.ritual_id) || '_' || NEW.game_date;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('ritual_completions', (SELECT uid FROM rituals WHERE id = NEW.ritual_id) || '_' || NEW.game_date, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER ritual_completions_sync_update AFTER UPDATE OF completed_at ON ritual_completions
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.completed_at IS NOT NEW.completed_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'ritual_completions' AND key = (SELECT uid FROM rituals WHERE id = NEW.ritual_id) || '_' || NEW.game_date;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('ritual_completions', (SELECT uid FROM rituals WHERE id = NEW.ritual_id) || '_' || NEW.game_date, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER ritual_completions_sync_delete AFTER DELETE ON ritual_completions WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'ritual_completions' AND key = (SELECT uid FROM rituals WHERE id = OLD.ritual_id) || '_' || OLD.game_date;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('ritual_completions', (SELECT uid FROM rituals WHERE id = OLD.ritual_id) || '_' || OLD.game_date, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- gear
CREATE TRIGGER gear_sync_insert AFTER INSERT ON gear WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'gear' AND key = NEW.item_key;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('gear', NEW.item_key, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER gear_sync_update AFTER UPDATE OF source_type, source_id, game_date, misses_before ON gear
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.source_type IS NOT NEW.source_type OR OLD.source_id IS NOT NEW.source_id OR OLD.game_date IS NOT NEW.game_date OR OLD.misses_before IS NOT NEW.misses_before) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'gear' AND key = NEW.item_key;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('gear', NEW.item_key, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER gear_sync_delete AFTER DELETE ON gear WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'gear' AND key = OLD.item_key;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('gear', OLD.item_key, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- equipment
CREATE TRIGGER equipment_sync_insert AFTER INSERT ON equipment WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'equipment' AND key = NEW.slot;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('equipment', NEW.slot, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER equipment_sync_update AFTER UPDATE OF gear_id ON equipment
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.gear_id IS NOT NEW.gear_id) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'equipment' AND key = NEW.slot;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('equipment', NEW.slot, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- achievements
CREATE TRIGGER achievements_sync_insert AFTER INSERT ON achievements WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'achievements' AND key = NEW.key;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('achievements', NEW.key, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- crest_parts
CREATE TRIGGER crest_parts_sync_insert AFTER INSERT ON crest_parts WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'crest_parts' AND key = NEW.key;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('crest_parts', NEW.key, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- week_goals
CREATE TRIGGER week_goals_sync_insert AFTER INSERT ON week_goals WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'week_goals' AND key = NEW.week_start;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('week_goals', NEW.week_start, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER week_goals_sync_update AFTER UPDATE OF goal_key, target, state, completed_at ON week_goals
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.goal_key IS NOT NEW.goal_key OR OLD.target IS NOT NEW.target OR OLD.state IS NOT NEW.state OR OLD.completed_at IS NOT NEW.completed_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'week_goals' AND key = NEW.week_start;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('week_goals', NEW.week_start, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER week_goals_sync_delete AFTER DELETE ON week_goals WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'week_goals' AND key = OLD.week_start;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('week_goals', OLD.week_start, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- chronicle
CREATE TRIGGER chronicle_sync_insert AFTER INSERT ON chronicle WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'chronicle' AND key = NEW.game_date;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('chronicle', NEW.game_date, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER chronicle_sync_update AFTER UPDATE OF happened, noticed, feeling, mood ON chronicle
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.happened IS NOT NEW.happened OR OLD.noticed IS NOT NEW.noticed OR OLD.feeling IS NOT NEW.feeling OR OLD.mood IS NOT NEW.mood) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'chronicle' AND key = NEW.game_date;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('chronicle', NEW.game_date, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- days
CREATE TRIGGER days_sync_insert AFTER INSERT ON days WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'days' AND key = NEW.game_date;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('days', NEW.game_date, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER days_sync_update AFTER UPDATE OF kind ON days
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.kind IS NOT NEW.kind) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'days' AND key = NEW.game_date;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('days', NEW.game_date, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- character
CREATE TRIGGER character_sync_insert AFTER INSERT ON character WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'character' AND key = 'hero';
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('character', 'hero', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER character_sync_update AFTER UPDATE OF name, location_key ON character
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.name IS NOT NEW.name OR OLD.location_key IS NOT NEW.location_key) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'character' AND key = 'hero';
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('character', 'hero', strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- settings
CREATE TRIGGER settings_sync_insert AFTER INSERT ON settings WHEN (SELECT applying FROM sync_flags) = 0 AND NEW.key NOT IN ('motion','sound_enabled') BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'settings' AND key = NEW.key;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('settings', NEW.key, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER settings_sync_update AFTER UPDATE OF value ON settings
WHEN (SELECT applying FROM sync_flags) = 0 AND NEW.key NOT IN ('motion','sound_enabled') AND (OLD.value IS NOT NEW.value) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'settings' AND key = NEW.key;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('settings', NEW.key, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

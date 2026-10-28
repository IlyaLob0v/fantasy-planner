-- Синхронизация таблиц V0.6–V0.7: главы Сказа, комнаты в таверне, чек-листы квестов и метка квеста
-- (specs/sync.md, раздел 1). Те же триггеры журнала исходящих, что в 0007: там эти таблицы ещё не существовали.

-- saga_chapters
CREATE TRIGGER saga_chapters_sync_insert AFTER INSERT ON saga_chapters WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'saga_chapters' AND key = NEW.key;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('saga_chapters', NEW.key, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER saga_chapters_sync_update AFTER UPDATE OF read_at ON saga_chapters
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.read_at IS NOT NEW.read_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'saga_chapters' AND key = NEW.key;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('saga_chapters', NEW.key, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- inn_stays
CREATE TRIGGER inn_stays_sync_insert AFTER INSERT ON inn_stays WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'inn_stays' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('inn_stays', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER inn_stays_sync_update AFTER UPDATE OF start_date, end_date, deleted_at ON inn_stays
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.start_date IS NOT NEW.start_date OR OLD.end_date IS NOT NEW.end_date OR OLD.deleted_at IS NOT NEW.deleted_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'inn_stays' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('inn_stays', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- quest_steps
CREATE TRIGGER quest_steps_sync_insert AFTER INSERT ON quest_steps WHEN (SELECT applying FROM sync_flags) = 0 BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'quest_steps' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('quest_steps', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
CREATE TRIGGER quest_steps_sync_update AFTER UPDATE OF quest_id, title, done_at, sort_order, deleted_at ON quest_steps
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.quest_id IS NOT NEW.quest_id OR OLD.title IS NOT NEW.title OR OLD.done_at IS NOT NEW.done_at OR OLD.sort_order IS NOT NEW.sort_order OR OLD.deleted_at IS NOT NEW.deleted_at) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'quest_steps' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('quest_steps', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

-- quests: метка из 0012 тоже синхронизируется
DROP TRIGGER quests_sync_update;
CREATE TRIGGER quests_sync_update AFTER UPDATE OF parent_id, type, title, description, attribute, difficulty, status, scheduled_date, due_date, damage, sort_order, completed_at, archived_at, label ON quests
WHEN (SELECT applying FROM sync_flags) = 0 AND (OLD.parent_id IS NOT NEW.parent_id OR OLD.type IS NOT NEW.type OR OLD.title IS NOT NEW.title OR OLD.description IS NOT NEW.description OR OLD.attribute IS NOT NEW.attribute OR OLD.difficulty IS NOT NEW.difficulty OR OLD.status IS NOT NEW.status OR OLD.scheduled_date IS NOT NEW.scheduled_date OR OLD.due_date IS NOT NEW.due_date OR OLD.damage IS NOT NEW.damage OR OLD.sort_order IS NOT NEW.sort_order OR OLD.completed_at IS NOT NEW.completed_at OR OLD.archived_at IS NOT NEW.archived_at OR OLD.label IS NOT NEW.label) BEGIN
    DELETE FROM sync_outbox WHERE tbl = 'quests' AND key = NEW.uid;
    INSERT INTO sync_outbox (tbl, key, changed_at) VALUES ('quests', NEW.uid, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;

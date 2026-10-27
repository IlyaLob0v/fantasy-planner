-- Синхронизация таблиц V0.6–V0.7: главы Сказа и комнаты в таверне (specs/sync.md, раздел 1).
-- Те же триггеры журнала исходящих, что в 0007: они там созданы раньше этих таблиц.

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

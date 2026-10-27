-- V0.6 «Дорога домой», часть 1: возвращение странника и Книга подвигов.
-- Дни в походе, календарь и вехи считаются из days и ledger, отдельных счётчиков нет.
-- Номер 0007 оставлен за синхронизацией.

INSERT INTO settings (key, value) VALUES
    ('journey', '{"return_after_days":3,"stale_offer":5}'),
    ('return_seen', '""');

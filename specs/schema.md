# Схема SQLite

За основу взято присланное минимальное ядро (`character`, `quests`, `inventory`, `settings`). Ниже итоговая схема, а в конце таблица всех отличий от ядра с причинами.

## Общие соглашения

- База лежит в каталоге данных приложения (`app_data_dir()/guild.db`), режим `WAL`, `foreign_keys = ON`.
- Миграции: `src-tauri/migrations/NNNN_name.sql`, применяются при старте через `sqlx::migrate!` до открытия окна. Миграции только добавляются, старые файлы не редактируются.
- Даты дня (`*_date`) хранятся как `TEXT 'YYYY-MM-DD'` в **игровых сутках**: локальная дата со сдвигом `settings.day_start_hour` (по умолчанию 04:00). Моменты времени (`*_at`) хранятся как `TEXT` ISO-8601 UTC.
- Золото и XP только целые числа (`INTEGER`), дробей нет.
- Логическое удаление через `archived_at`, чтобы журнал наград никогда не ссылался в пустоту.

## Миграция 0001 (V0.1)

```sql
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
```

Начальные данные `settings` (заполняются в той же миграции):

| key | значение по умолчанию | смысл |
|---|---|---|
| `day_start_hour` | `4` | час начала игровых суток |
| `rates` | `{"side":{"xp":10,"gold":3},"main":{"xp":30,"gold":10},"stage":{"xp":15,"gold":4},"boss_defeat":{"xp":60,"gold":25},"ritual":{"xp":5,"gold":2},"rest_action":{"xp":3,"gold":0}}` | базовые ставки, умножаются на сложность 1–3 |
| `streak_bonus` | `{"step_days":7,"step_pct":10,"max_pct":30,"on_miss":"drop_one_step"}` | «Попутный ветер»: бонус к золоту |
| `level_curve` | `{"base":50,"exp":1.4,"round":5}` | XP до следующего уровня |
| `rest_price` | `40` | цена дня отдыха |
| `sound_enabled` | `false` | звук |
| `motion` | `"full"` | `full` / `reduced` анимации |

## Миграция 0002 (V0.2): ритуалы и лавка

```sql
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
```

## Миграция 0003 (V0.3): хроника и локации

```sql
CREATE TABLE chronicle (
    game_date       TEXT    PRIMARY KEY,
    happened        TEXT    NOT NULL DEFAULT '',       -- что произошло
    noticed         TEXT    NOT NULL DEFAULT '',       -- что заметил
    feeling         TEXT    NOT NULL DEFAULT '',       -- что чувствую
    mood            INTEGER CHECK (mood BETWEEN 1 AND 5),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Каталог локаций (сидируется из реестра ассетов). Владение — строка в inventory.
CREATE TABLE locations (
    key             TEXT    PRIMARY KEY,               -- 'gatehouse', 'forest_camp', ...
    name            TEXT    NOT NULL,
    asset_key       TEXT    NOT NULL,
    unlock_level    INTEGER NOT NULL DEFAULT 1,
    price           INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0
);
```

## Производные значения (считаются в TS-сервисах, не хранятся)

- **«Сегодня / завтра / просрочен»** у квеста: из `scheduled_date`, `due_date` и текущих игровых суток.
- **HP босса**: `max = SUM(damage)` всех этапов, `current = SUM(damage)` невыполненных.
- **Уровень**: из `character.xp` по `level_curve`. Поле `level` хранится, чтобы поймать момент повышения и показать оверлей.
- **Серия**: подряд идущие `days`, где `deeds_count > 0` или `kind = 'rest'`.
- **Ритуалы на сегодня**: из `schedule` и `paused_until`; для `times_per_week` ритуал виден, пока за текущую неделю (пн–вс) отметок меньше N.
- **Ступень бонуса**: +1 за каждые 7 дней серии, −1 за пропуск (не ниже 0).

## Что изменено относительно присланного ядра и почему

| Было в ядре | Стало | Почему |
|---|---|---|
| `status IN ('today','tomorrow','overdue','done')` | `status IN ('active','done')` + `scheduled_date`, `due_date` | «Сегодня» и «просрочено» зависят от текущей даты. Хранимый статус пришлось бы переписывать каждую полночь, и он бы расходился с реальностью. |
| `type` включает `'habit'` | Ритуалы в отдельных таблицах `rituals` + `ritual_completions` (гибкое расписание и пауза) | У привычки есть расписание и отметка на каждый день, у квеста только одно выполнение. В одной таблице получились бы десятки копий «Утренней молитвы». |
| `type` без этапов | Добавлен `'stage'` для подзадач босса | `parent_id` из ядра сохранён. Тип `stage` позволяет проверкой гарантировать, что этап всегда имеет родителя и что у него есть `damage`. |
| `boss_hp` хранится | HP вычисляется из этапов | Хранимое HP расходится с этапами при редактировании и отмене. |
| `difficulty` | Оставлено, `NOT NULL` и `CHECK 1–3` | Входит в формулу награды (решение В1). |
| `xp_reward`, `gold_reward` на квесте | Ставки в `settings.rates`, факт начисления в `ledger` | Награда считается в TS по ставкам. Журнал фиксирует, что реально начислено, и позволяет честно отменить случайный клик. |
| `character`: только `level/xp/gold` + атрибуты | Добавлены `streak_*`, `fatigued_since`, `location_key`, `title`; `id = 1` закреплён проверкой | Нужны для серии, усталости и фона главного экрана. Атрибуты оставлены колонками, как в ядре (если в В2 выберешь «Дух», добавится четвёртая колонка). |
| `CHECK` на числа отсутствуют, `DEFAULT` без `NOT NULL` | Везде `NOT NULL` + `CHECK` | Защита от `NULL` и отрицательного золота на уровне базы, а не только в коде. |
| `inventory.illustration_path` | `asset_key` + `item_type`, `source_*`, `redeemed_at` | Путь к файлу ломается при переносе артов. Ключ указывает в единый реестр ассетов. Инвентарь хранит лут, купленные награды и локации. |
| Локации в `settings` | Таблица `locations` + владение в `inventory` | Локации имеют цену и уровень открытия, это структурированные данные, а не настройка. |
| `datetime('now')` | ISO-8601 UTC с миллисекундами | Однозначный формат для TS (`new Date()` парсит без сюрпризов). |
| — | `ledger`, `days`, `rewards`, `chronicle` | Журнал наград, серия/отдых, лавка и хроника из брифа. |

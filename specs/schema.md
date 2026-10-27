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
```

### Итог хода (`commit_outcome`)

Все изменения от одного действия игрока пишутся одной транзакцией. TS присылает уже посчитанный итог:

| Поле | Что пишет |
|---|---|
| `quests` | смены статуса квестов: этап и, при победе, сам босс |
| `ritual` | отметка ритуала или её снятие |
| `inventory` | новые предметы: награда из лавки, трофей (`rarity`, `asset_key`), локация |
| `removeInventory` | id трофеев, которые убирает отмена победы (удаляются только `item_type = 'loot'`) |
| `ledger` | записи журнала, в том числе обратные (`revert`) |
| `days` | строки суток |
| `character` | новый кэш персонажа |
| `achievements`, `gear`, `removeGear` | V0.5: открытые достижения, новые предметы, находки, которые забирает отмена |
| `weekGoalsDone`, `crestParts` | V0.5: выполненные цели недели, купленные части герба |

## Миграция 0004 (V0.5): Зал славы и Присяга гильдии

- **`ledger` пересобирается** с расширенным `CHECK` источников: добавлены `'achievement'` (золото за достижение, `note` = ключ достижения) и `'week_chest'` (сундук недели, часть 4 V0.5). SQLite не меняет `CHECK` на месте, поэтому строки копируются в новую таблицу с теми же `id` и связями `reverts_id`. Добавлен индекс `idx_ledger_reverts`.
- **`achievements`**: факт открытия достижения.

| Колонка | Тип | Смысл |
|---|---|---|
| `key` | `TEXT PK` | стабильный ключ из каталога `src/domain/achievements.ts` |
| `uid` | `TEXT NOT NULL UNIQUE` | UUID v7 для синхронизации между устройствами |
| `unlocked_at`, `updated_at` | `TEXT` | ISO UTC |

  Строка не удаляется никогда: достижение не отбирается, даже если отмена квеста уменьшила счётчик.
- **`settings`**: `oath_done` (Присяга пройдена; у базы с записями в журнале сразу `true`), `hints_seen` (массив ключей показанных подсказок). Оба ключа меняются через `set_setting`.
- **Новые команды:** `ledger_tally` (число записей журнала в силе по `source_type` и `source_id`, без отменённых и самих отмен) и `list_achievements`. `commit_outcome` принимает `achievements: [{ key, uid }]` и пишет их в той же транзакции, что и золото за них; повторное открытие того же ключа откатывает всю транзакцию.

## Миграция 0005 (V0.5): снаряжение и кузница

- **`gear`**: предмет у героя. `uid` (UUID v7), `item_key` UNIQUE (дублей нет), `source_type` (`quest` — квест или этап, `ritual`, `boss`, `achievement` — реликвия, `forge` — покупка, `week_chest` — сундук недели), `source_id`, `game_date`, `misses_before` (счётчик невезения до этой находки: отмена дела возвращает его). Каталог 40 предметов и 5 реликвий живёт в `src/domain/gear.ts`. Отмена дела удаляет его находку; купленное и реликвии не удаляются.
- **`equipment`**: пять строк `weapon / helm / armor / cloak / talisman`, `gear_id` NULL или ссылка на `gear` (`ON DELETE SET NULL`). Ключ синхронизации — сам слот.
- **`character.loot_misses`**: дела подряд без находки, кэш для защиты от невезения.
- **`settings`**: `loot` (`base_pct` 12, `step_pct` 4, `pity` 15, `daily_cap` 2, `weights` по редкости 60/28/10/2, `unlock_level` 1/5/10/15) и `forge_prices` (обычный 60, редкий 150). Оба меняются в «Уставе».
- **Команды:** `list_gear`, `list_equipment`, `set_equipment(slot, gear_id)`. `commit_outcome` принимает `gear` (новые предметы) и `removeGear` (id находок, которые забирает отмена).

## Миграция 0006 (V0.5): неделя гильдии и герб

- **`week_goals`**: цель недели. `uid` (UUID v7), `week_start` (понедельник игровой недели), `goal_key` (ключ из `src/domain/week.ts`: `deeds`, `main`, `rituals`, `boss`, `days`, `chronicle`), `target`, `state` (`active` / `done` / `off`), `completed_at`, `updated_at`; `UNIQUE (week_start, goal_key)`. Прогресс не хранится: считается из журнала, квестов и хроники. Невыполненная цель прошлой недели так и остаётся `active`, без пометок.
- **`crest_parts`**: купленные части герба. `key` PK (`shield.round`, `charge.star`, `tincture.blue`…), `uid`, `bought_at`, `updated_at`. Части по умолчанию (треугольный щит, башня, бордо) бесплатны и не пишутся.
- **`settings`**: `week` (`goal_gold` 20, `chest_gold` 60, `stretch_pct` 10), `recap_seen` (понедельник недели, летопись которой закрыта), `crest` (выбранные `shield`, `charge`, `tincture`), `crest_price` (40). Всё меняется через `set_setting`.
- **Журнал:** золото за цель — `week_chest` с `source_id` = id цели и `note` = `goal:<ключ>`; сундук — `week_chest` с `note` = `chest`. Часть герба — `purchase` с `note` «Герб: …». Предмет из сундука — `gear.source_type = 'week_chest'`.
- **Команды:** `list_ledger_since(since)`, `list_week_goals(since)`, `create_week_goals(goals)` (`INSERT OR IGNORE`, повтор для той же недели ничего не меняет), `update_week_goal(id, goal_key, target, state)` (замена или выключение; выполненную цель не трогает), `list_crest_parts`. `commit_outcome` принимает `weekGoalsDone` (id целей: `active` → `done`, иначе откат всей транзакции) и `crestParts`.

## Производные значения (считаются в TS-сервисах, не хранятся)

- **«Сегодня / завтра / просрочен»** у квеста: из `scheduled_date`, `due_date` и текущих игровых суток.
- **HP босса**: `max = SUM(damage)` всех этапов, `current = SUM(damage)` невыполненных.
- **Уровень**: из `character.xp` по `level_curve`. Поле `level` хранится, чтобы поймать момент повышения и показать оверлей.
- **Серия**: подряд идущие `days`, где `deeds_count > 0` или `kind = 'rest'`.
- **Ритуалы на сегодня**: из `schedule` и `paused_until`; для `times_per_week` ритуал виден, пока за текущую неделю (пн–вс) отметок меньше N.
- **Ступень бонуса**: +1 за каждые 7 дней серии, −1 за пропуск (не ниже 0).
- **Находка**: бросок детерминирован (сид из дела и игрового дня), шанс `base + step × промахи`, на `pity`-м деле гарантия; пул — предметы без реликвий, которых ещё нет, с редкостью, открытой уровнем. Способности — по надетым предметам.
- **Цели недели**: прогресс из журнала в силе за неделю (дела = квесты, этапы и ритуалы; урон = `damage` выполненных этапов; дни = дни хотя бы с одним делом) и хроники. Цель подбирается как среднее последних 4 недель с делами плюс `stretch_pct`, не ниже порога новичка; цель, поставленная посреди недели, засчитывает сделанное до сегодня и просит долю на оставшиеся дни.
- **Прогресс достижений**: из `ledger_tally`, квестов, `days` и кэша персонажа. «Возвращение» = успешный день после закрытого дня без дел.

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

## Миграция 0008 (V0.6): возвращение странника и Книга подвигов

Номер 0007 оставлен за синхронизацией.

- **`settings`**: `journey` (`return_after_days` 3, `stale_offer` 5), `return_seen` (последний день с делом перед перерывом, карточку которого уже закрыли). Меняются через `set_setting`.
- Новых таблиц нет. Дни в походе, календарь года и вехи ветки «Поход» в Зале славы (10, 30, 60, 100, 200, 365 дней, золото по ступени через `ledger`, `source_type = 'achievement'`) выводятся из `days`. `list_days` теперь читается за всё время: строка на сутки, этого немного.

## Миграция 0009 (V0.6): мягкое напоминание

- **`settings`**: `reminder` (`enabled` false, `hour` 19 по местному времени, `quiet_weekdays` [] где 0 = понедельник). Меняется через `set_setting`; включение сначала спрашивает разрешение ОС.
- Таблиц нет. План напоминаний (`src/domain/reminder.ts`) выводится из `days` и настроек: не больше одного в сутки, только в день без дел, не в тихие дни и не в дни отдыха.

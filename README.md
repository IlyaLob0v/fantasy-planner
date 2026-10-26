# Fantasy Planner

Персональный ежедневник-трекер-планировщик в фэнтези-стилистике. Десктопное приложение на Tauri v2 + React + TypeScript + SQLite.

Спецификации лежат в `specs/`, правила разработки в `CLAUDE.md`.

## Запуск

Нужны Node.js 22+, pnpm 10+, Rust 1.90+ и системные зависимости Tauri v2 для своей ОС
(https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm tauri dev      # разработка
pnpm tauri build    # установщик в src-tauri/target/release/bundle
```

База лежит в каталоге данных приложения (`guild.db`), миграции применяются при старте.

## Проверки

```bash
pnpm typecheck && pnpm lint && pnpm test
cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

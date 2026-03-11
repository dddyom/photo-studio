# Photo Studio

Local-first desktop-приложение для управления заказами на печать фотографий и сборку школьных фотоальбомов.

## Стек

Tauri 2 + React + TypeScript + Vite + Tailwind CSS + SQLite

## Быстрый старт

```bash
# Зависимости
pnpm install

# Запуск в dev-режиме (frontend + Tauri backend)
pnpm dev
```

Приложение откроется в нативном окне. БД создастся автоматически в `data/photo_studio_dev.db`.

## Команды

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Запуск приложения (Tauri + Vite) |
| `pnpm dev:web` | Запуск только frontend (без Tauri) |
| `pnpm build` | Сборка production-установщика |
| `pnpm build:web` | Сборка только frontend |
| `pnpm typecheck` | Проверка типов TypeScript |
| `pnpm lint` | Линтинг (typecheck) |
| `pnpm test` | Тесты (заглушка) |

## Сборка

```bash
pnpm build
```

Установщик появится в `src-tauri/target/release/bundle/`.

## База данных

| Среда | Расположение |
|-------|-------------|
| Dev | `./data/photo_studio_dev.db` |
| Test | `./data/photo_studio_test.db` (через env `PHOTO_STUDIO_DB_PATH`) |
| Production (Windows) | `%APPDATA%/com.photostudio.app/photo_studio.db` |
| Backup | Копия файла БД в `data/backups/` (dev) или app data dir (prod) |

## Структура проекта

```
src/                    # Frontend (React + TypeScript + Tailwind)
src-tauri/              # Backend (Rust, Tauri, SQLite)
data/                   # Dev/test database files (gitignored)
docs/                   # Документация
```

Подробнее: [docs/technical-setup.md](docs/technical-setup.md)

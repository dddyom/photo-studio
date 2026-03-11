# Technical Setup

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2 |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 (via `@tailwindcss/vite` plugin) |
| Backend logic | Rust (Tauri commands) |
| Database | SQLite (rusqlite, bundled) |
| Forms | React Hook Form + Zod |
| Notifications | react-hot-toast |
| Routing | React Router v7 |

## Project structure

```
photo/
├── src/                          # Frontend (React + TypeScript)
│   ├── main.tsx                  # Entry point
│   ├── app/                      # App shell: layout, sidebar, routing
│   │   ├── App.tsx               # Router + Toaster setup
│   │   ├── AppShell.tsx          # Sidebar + main content layout
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   └── styles.css            # Tailwind import + minimal base styles
│   ├── pages/                    # Page components (one per route)
│   ├── shared/                   # Shared UI components and hooks
│   │   ├── ui/                   # Reusable UI primitives
│   │   └── hooks/                # Custom hooks (useTauriCommand, etc.)
│   └── infrastructure/           # Bridge between frontend and backend
│       └── tauri-bridge.ts       # Typed wrappers for invoke()
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── main.rs
│   │   ├── lib.rs                # Tauri builder, command registration
│   │   ├── db/
│   │   │   ├── mod.rs            # DB init, connection state, path resolution
│   │   │   ├── migrations.rs     # Versioned schema migrations
│   │   │   └── seed.rs           # Initial + demo data
│   │   └── commands/             # Tauri command handlers
│   ├── Cargo.toml
│   └── tauri.conf.json
├── data/                         # Dev/test database files (gitignored)
│   └── .gitkeep
├── docs/                         # Documentation
└── package.json
```

## Commands

```bash
pnpm dev          # Run Tauri app in dev mode (frontend + backend)
pnpm dev:web      # Run frontend only (Vite dev server, no Tauri)
pnpm build        # Build production installer (tauri build)
pnpm build:web    # Build frontend only (tsc + vite build)
pnpm typecheck    # Type check TypeScript
pnpm lint         # Lint (currently = typecheck)
pnpm test         # Run tests (placeholder)
```

## Tailwind CSS

- **Version**: Tailwind CSS v4
- **Integration**: `@tailwindcss/vite` plugin (zero-config, no `tailwind.config.js` needed)
- **Entry point**: `src/app/styles.css` imports `@import "tailwindcss"`
- **Approach**: utility classes directly in JSX, minimal custom CSS
- All layout, spacing, typography, buttons, inputs, cards, tables use Tailwind utilities

## Database

### Path resolution

| Environment | Path | Mechanism |
|-------------|------|-----------|
| Dev | `./data/photo_studio_dev.db` | `cfg!(debug_assertions)` |
| Test | any path | env var `PHOTO_STUDIO_DB_PATH` |
| Production | `{app_data_dir}/photo_studio.db` | Tauri `path().app_data_dir()` |

On Windows production: `%APPDATA%/com.photostudio.app/photo_studio.db`.

### Backup strategy

- Dev: copy `data/photo_studio_dev.db` to `data/backups/`
- Production: copy DB file from app data dir
- Future: dedicated backup command in Settings page

### SQLite pragmas (set on every connection open)

```sql
PRAGMA journal_mode = WAL;       -- Write-ahead logging for crash resilience
PRAGMA foreign_keys = ON;        -- Enforce FK constraints
PRAGMA synchronous = NORMAL;     -- Good balance of safety and performance
```

### Access pattern

- All DB operations go through Tauri commands (Rust side).
- `src/infrastructure/tauri-bridge.ts` provides typed wrappers. Frontend never calls `invoke()` directly.
- No ORM. Raw SQL in Rust command handlers.
- UI components never write SQL.

## Migrations

### How it works

1. On app startup, `db::migrations::run()` is called.
2. The `_migrations` table is bootstrapped (CREATE TABLE IF NOT EXISTS).
3. Current version = `MAX(version)` from `_migrations`.
4. Each migration with `version > current_version` is applied in order.
5. After applying, the version + description are recorded in `_migrations`.

### How to add a migration

Append to the `MIGRATIONS` array in `src-tauri/src/db/migrations.rs`:

```rust
(5, "create pricing_programs table", "
    CREATE TABLE pricing_programs ( ... );
"),
```

Rules:
- Never modify or delete already-applied migrations.
- Version numbers must be sequential.
- Each migration should be idempotent where possible (but the runner skips already-applied ones).

## .gitignore

Key entries:
- `data/*.db`, `data/*.sqlite`, `data/backups/` — database files never committed
- `node_modules/`, `dist/`, `src-tauri/target/` — build artifacts
- `*.log`, `*.tmp` — temp files
- OS files (`.DS_Store`, `Thumbs.db`)

## Error handling

- Rust commands return `Result<T, String>`.
- Frontend `useTauriCommand` hook auto-shows toast on error.
- Manual operations use try/catch + `toast.error()`.

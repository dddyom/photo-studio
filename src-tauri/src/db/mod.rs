pub mod migrations;
pub mod seed;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

pub struct DbState {
    pub conn: Mutex<Connection>,
    pub db_path: PathBuf,
}

/// Resolve the database file path.
/// Override: env `PHOTO_STUDIO_DB_PATH` (for tests or custom locations).
/// Dev:     `{project_root}/data/photo_studio_dev.db`
/// Release: `{app_data_dir}/photo_studio.db`
pub fn resolve_db_path(app: &tauri::AppHandle) -> PathBuf {
    if let Ok(p) = std::env::var("PHOTO_STUDIO_DB_PATH") {
        let path = PathBuf::from(p);
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        return path;
    }

    if cfg!(debug_assertions) {
        // In dev, Tauri sets CWD to project root (where tauri.conf.json's
        // parent is). But if running via `cargo run` from src-tauri/,
        // we detect that and go up one level.
        let mut base = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        if base.join("Cargo.toml").exists() && !base.join("package.json").exists() {
            // We're in src-tauri/, go up to project root
            base = base.parent().unwrap_or(&base).to_path_buf();
        }
        let data_dir = base.join("data");
        std::fs::create_dir_all(&data_dir).ok();
        data_dir.join("photo_studio_dev.db")
    } else {
        let base = app
            .path()
            .app_data_dir()
            .expect("failed to resolve app data dir");
        std::fs::create_dir_all(&base).ok();
        base.join("photo_studio.db")
    }
}

pub fn init_db(app: &tauri::AppHandle) -> Result<DbState, String> {
    let db_path = resolve_db_path(app);
    log::info!("Opening database at: {}", db_path.display());

    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open DB: {e}"))?;

    // SQLite pragmas for reliability and performance
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         PRAGMA synchronous = NORMAL;"
    )
    .map_err(|e| format!("Failed to set pragmas: {e}"))?;

    // Run migrations
    migrations::run(&conn).map_err(|e| format!("Migration failed: {e}"))?;

    Ok(DbState {
        conn: Mutex::new(conn),
        db_path,
    })
}

use serde::Serialize;
use tauri::State;

use crate::db::DbState;

#[derive(Serialize)]
pub struct DbInfo {
    pub path: String,
    pub version: i32,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn get_db_info(db: State<DbState>) -> Result<DbInfo, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let version: i32 = conn
        .query_row("SELECT COALESCE(MAX(version), 0) FROM _migrations", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;

    let size = std::fs::metadata(&db.db_path)
        .map(|m| m.len())
        .unwrap_or(0);

    Ok(DbInfo {
        path: db.db_path.display().to_string(),
        version,
        size_bytes: size,
    })
}

#[derive(Serialize)]
pub struct AppSettings {
    pub company_name: String,
}

#[tauri::command]
pub fn get_settings(db: State<DbState>) -> Result<AppSettings, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let company_name: String = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'company_name'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "Фотостудия".to_string());

    Ok(AppSettings { company_name })
}

#[tauri::command]
pub fn update_setting(db: State<DbState>, key: String, value: String) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn seed_demo_data(db: State<DbState>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    crate::db::seed::seed_demo(&conn).map_err(|e| e.to_string())
}

// ── Backup / Restore ────────────────────────────────────────────────

fn backup_dir(db: &DbState) -> std::path::PathBuf {
    db.db_path.parent().unwrap_or(std::path::Path::new(".")).join("backups")
}

#[derive(Serialize)]
pub struct BackupInfo {
    pub filename: String,
    pub size_bytes: u64,
    pub created_at: String,
}

#[tauri::command]
pub fn create_backup(db: State<DbState>) -> Result<BackupInfo, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // WAL checkpoint to ensure all data is in the main file
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| format!("Ошибка checkpoint: {e}"))?;

    let dir = backup_dir(&db);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Не удалось создать папку backups: {e}"))?;

    let now = chrono::Local::now();
    let filename = format!("photo_studio_{}.db", now.format("%Y-%m-%d_%H-%M-%S"));
    let dest = dir.join(&filename);

    std::fs::copy(&db.db_path, &dest)
        .map_err(|e| format!("Ошибка копирования: {e}"))?;

    let size = std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0);

    Ok(BackupInfo {
        filename,
        size_bytes: size,
        created_at: now.format("%Y-%m-%d %H:%M:%S").to_string(),
    })
}

#[tauri::command]
pub fn list_backups(db: State<DbState>) -> Result<Vec<BackupInfo>, String> {
    let dir = backup_dir(&db);
    if !dir.exists() {
        return Ok(vec![]);
    }

    let mut backups = Vec::new();
    let entries = std::fs::read_dir(&dir)
        .map_err(|e| format!("Ошибка чтения папки backups: {e}"))?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("db") {
            let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
            let modified = meta.modified().ok()
                .and_then(|t| {
                    let dt: chrono::DateTime<chrono::Local> = t.into();
                    Some(dt.format("%Y-%m-%d %H:%M:%S").to_string())
                })
                .unwrap_or_default();
            backups.push(BackupInfo {
                filename,
                size_bytes: meta.len(),
                created_at: modified,
            });
        }
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

#[tauri::command]
pub fn restore_backup(db: State<DbState>, filename: String) -> Result<String, String> {
    let dir = backup_dir(&db);
    let src = dir.join(&filename);

    if !src.exists() {
        return Err(format!("Файл не найден: {filename}"));
    }

    // Validate that it's a valid SQLite file
    {
        let test_conn = rusqlite::Connection::open(&src)
            .map_err(|e| format!("Файл повреждён или не является базой данных: {e}"))?;
        let _ver: i32 = test_conn
            .query_row("SELECT COALESCE(MAX(version), 0) FROM _migrations", [], |r| r.get(0))
            .map_err(|_| "Файл не содержит данных приложения".to_string())?;
    }

    // Close WAL on current DB
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);").ok();
    }

    // Copy backup over current DB
    std::fs::copy(&src, &db.db_path)
        .map_err(|e| format!("Ошибка восстановления: {e}"))?;

    // Remove WAL/SHM files if they exist
    let wal = db.db_path.with_extension("db-wal");
    let shm = db.db_path.with_extension("db-shm");
    std::fs::remove_file(&wal).ok();
    std::fs::remove_file(&shm).ok();

    Ok("База данных восстановлена. Перезапустите приложение.".to_string())
}

#[tauri::command]
pub fn delete_backup(db: State<DbState>, filename: String) -> Result<(), String> {
    let dir = backup_dir(&db);
    let path = dir.join(&filename);
    if !path.exists() {
        return Err(format!("Файл не найден: {filename}"));
    }
    std::fs::remove_file(&path).map_err(|e| format!("Ошибка удаления: {e}"))?;
    Ok(())
}

// ── CSV Export ──────────────────────────────────────────────────────

fn export_dir(db: &DbState) -> std::path::PathBuf {
    db.db_path.parent().unwrap_or(std::path::Path::new(".")).join("exports")
}

fn csv_escape(s: &str) -> String {
    if s.contains(',') || s.contains('"') || s.contains('\n') {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

#[tauri::command]
pub fn export_orders_csv(db: State<DbState>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT o.number, c.name, o.production_status, o.payment_status, o.delivery_status,
                o.total_amount, o.paid_amount, (o.total_amount - o.paid_amount) as debt,
                o.notes, o.due_date, o.created_at
         FROM orders o LEFT JOIN clients c ON o.client_id = c.id
         ORDER BY o.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let mut csv = String::from("Номер,Клиент,Статус производства,Статус оплаты,Статус выдачи,Сумма,Оплачено,Долг,Примечания,Дата готовности,Дата создания\n");

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, f64>(5)?,
            row.get::<_, f64>(6)?,
            row.get::<_, f64>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, Option<String>>(9)?,
            row.get::<_, String>(10)?,
        ))
    }).map_err(|e| e.to_string())?;

    for row in rows {
        let r = row.map_err(|e| e.to_string())?;
        csv.push_str(&format!(
            "{},{},{},{},{},{:.2},{:.2},{:.2},{},{},{}\n",
            csv_escape(&r.0),
            csv_escape(&r.1.unwrap_or_default()),
            csv_escape(&r.2),
            csv_escape(&r.3),
            csv_escape(&r.4),
            r.5, r.6, r.7,
            csv_escape(&r.8.unwrap_or_default()),
            csv_escape(&r.9.unwrap_or_default()),
            csv_escape(&r.10),
        ));
    }

    let dir = export_dir(&db);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let now = chrono::Local::now();
    let path = dir.join(format!("orders_{}.csv", now.format("%Y-%m-%d_%H-%M-%S")));
    // Write with BOM for Excel compatibility
    let mut content = vec![0xEF, 0xBB, 0xBF];
    content.extend_from_slice(csv.as_bytes());
    std::fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(path.display().to_string())
}

#[tauri::command]
pub fn export_transactions_csv(db: State<DbState>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT ft.transaction_date, ft.transaction_type, ft.amount, ft.direction,
                ca.name as account_name, ft.description,
                o.number as order_number,
                p.name as partner_name,
                fc.name as category_name
         FROM finance_transactions ft
         LEFT JOIN company_accounts ca ON ft.account_id = ca.id
         LEFT JOIN orders o ON ft.order_id = o.id
         LEFT JOIN partners p ON ft.partner_id = p.id
         LEFT JOIN finance_categories fc ON ft.finance_category_id = fc.id
         ORDER BY ft.transaction_date DESC, ft.id DESC"
    ).map_err(|e| e.to_string())?;

    let mut csv = String::from("Дата,Тип,Сумма,Направление,Счёт,Описание,Заказ,Партнёр,Категория\n");

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<String>>(8)?,
        ))
    }).map_err(|e| e.to_string())?;

    for row in rows {
        let r = row.map_err(|e| e.to_string())?;
        csv.push_str(&format!(
            "{},{},{:.2},{},{},{},{},{},{}\n",
            csv_escape(&r.0),
            csv_escape(&r.1),
            r.2,
            csv_escape(&r.3),
            csv_escape(&r.4.unwrap_or_default()),
            csv_escape(&r.5.unwrap_or_default()),
            csv_escape(&r.6.unwrap_or_default()),
            csv_escape(&r.7.unwrap_or_default()),
            csv_escape(&r.8.unwrap_or_default()),
        ));
    }

    let dir = export_dir(&db);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let now = chrono::Local::now();
    let path = dir.join(format!("transactions_{}.csv", now.format("%Y-%m-%d_%H-%M-%S")));
    let mut content = vec![0xEF, 0xBB, 0xBF];
    content.extend_from_slice(csv.as_bytes());
    std::fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(path.display().to_string())
}

#[tauri::command]
pub fn export_partner_settlements_csv(db: State<DbState>) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT p.name, pse.entry_type, pse.amount, pse.description, pse.period, pse.created_at
         FROM partner_settlement_entries pse
         JOIN partners p ON pse.partner_id = p.id
         ORDER BY pse.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let mut csv = String::from("Партнёр,Тип операции,Сумма,Описание,Период,Дата\n");

    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, String>(5)?,
        ))
    }).map_err(|e| e.to_string())?;

    for row in rows {
        let r = row.map_err(|e| e.to_string())?;
        csv.push_str(&format!(
            "{},{},{:.2},{},{},{}\n",
            csv_escape(&r.0),
            csv_escape(&r.1),
            r.2,
            csv_escape(&r.3.unwrap_or_default()),
            csv_escape(&r.4.unwrap_or_default()),
            csv_escape(&r.5),
        ));
    }

    let dir = export_dir(&db);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let now = chrono::Local::now();
    let path = dir.join(format!("partner_settlements_{}.csv", now.format("%Y-%m-%d_%H-%M-%S")));
    let mut content = vec![0xEF, 0xBB, 0xBF];
    content.extend_from_slice(csv.as_bytes());
    std::fs::write(&path, content).map_err(|e| e.to_string())?;

    Ok(path.display().to_string())
}

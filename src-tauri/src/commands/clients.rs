use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;

#[derive(Debug, Serialize, Deserialize)]
pub struct Client {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub default_pricing_program_id: Option<i64>,
    pub notes: Option<String>,
    pub is_archived: bool,
    pub balance: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateClientInput {
    pub name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub default_pricing_program_id: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateClientInput {
    pub name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub default_pricing_program_id: Option<i64>,
    pub notes: Option<String>,
}

const CLIENT_SELECT: &str =
    "SELECT id, name, phone, email, default_pricing_program_id, notes, is_archived, balance, created_at, updated_at FROM clients";

fn row_to_client(row: &rusqlite::Row) -> rusqlite::Result<Client> {
    Ok(Client {
        id: row.get(0)?,
        name: row.get(1)?,
        phone: row.get(2)?,
        email: row.get(3)?,
        default_pricing_program_id: row.get(4)?,
        notes: row.get(5)?,
        is_archived: row.get(6)?,
        balance: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
    })
}

#[tauri::command]
pub fn list_clients(db: State<DbState>) -> Result<Vec<Client>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!("{CLIENT_SELECT} WHERE is_archived = 0 ORDER BY name"))
        .map_err(|e| e.to_string())?;

    let clients = stmt
        .query_map([], |row| row_to_client(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(clients)
}

#[tauri::command]
pub fn get_client(db: State<DbState>, id: i64) -> Result<Client, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        &format!("{CLIENT_SELECT} WHERE id = ?1"),
        rusqlite::params![id],
        |row| row_to_client(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_client(db: State<DbState>, input: CreateClientInput) -> Result<Client, String> {
    if input.name.trim().is_empty() {
        return Err("Имя клиента обязательно".to_string());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO clients (name, phone, email, default_pricing_program_id, notes)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            input.name,
            input.phone,
            input.email,
            input.default_pricing_program_id,
            input.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        &format!("{CLIENT_SELECT} WHERE id = ?1"),
        rusqlite::params![id],
        |row| row_to_client(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_client(
    db: State<DbState>,
    id: i64,
    input: UpdateClientInput,
) -> Result<Client, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Check client exists
    let _: i64 = conn
        .query_row(
            "SELECT id FROM clients WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Клиент не найден".to_string())?;

    // Build dynamic update
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref name) = input.name {
        if name.trim().is_empty() {
            return Err("Имя клиента не может быть пустым".to_string());
        }
        sets.push(format!("name = ?{idx}"));
        params.push(Box::new(name.clone()));
        idx += 1;
    }
    if let Some(ref phone) = input.phone {
        sets.push(format!("phone = ?{idx}"));
        params.push(Box::new(phone.clone()));
        idx += 1;
    }
    if let Some(ref email) = input.email {
        sets.push(format!("email = ?{idx}"));
        params.push(Box::new(email.clone()));
        idx += 1;
    }
    if let Some(ppid) = input.default_pricing_program_id {
        sets.push(format!("default_pricing_program_id = ?{idx}"));
        params.push(Box::new(ppid));
        idx += 1;
    }
    if let Some(ref notes) = input.notes {
        sets.push(format!("notes = ?{idx}"));
        params.push(Box::new(notes.clone()));
        idx += 1;
    }

    if sets.is_empty() {
        return Err("Нет полей для обновления".to_string());
    }

    sets.push(format!("updated_at = datetime('now')"));
    let sql = format!(
        "UPDATE clients SET {} WHERE id = ?{idx}",
        sets.join(", ")
    );
    params.push(Box::new(id));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;

    conn.query_row(
        &format!("{CLIENT_SELECT} WHERE id = ?1"),
        rusqlite::params![id],
        |row| row_to_client(row),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_all_clients(db: State<DbState>) -> Result<Vec<Client>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!("{CLIENT_SELECT} ORDER BY is_archived ASC, name ASC"))
        .map_err(|e| e.to_string())?;

    let clients = stmt
        .query_map([], |row| row_to_client(row))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(clients)
}

#[tauri::command]
pub fn archive_client(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE clients SET is_archived = 1, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Клиент не найден".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn unarchive_client(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE clients SET is_archived = 0, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Клиент не найден".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn delete_client(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Check for orders referencing this client
    let order_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM orders WHERE client_id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if order_count > 0 {
        return Err(format!("Нельзя удалить клиента: есть {} заказ(ов)", order_count));
    }

    let affected = conn
        .execute("DELETE FROM clients WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Клиент не найден".to_string());
    }
    Ok(())
}

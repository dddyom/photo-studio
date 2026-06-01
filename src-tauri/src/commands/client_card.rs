use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;

// ── DTOs ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ClientCardSummary {
    pub orders_total: i64,
    pub orders_active: i64,
    pub orders_cancelled: i64,
    pub revenue: f64,
    pub avg_check: f64,
    pub current_debt: f64,
    /// Money stranded inside orders where paid_amount exceeds total_amount
    /// (e.g. items cancelled after payment). Should normally be 0 — a positive
    /// value signals credit that belongs on the client's balance.
    pub overpaid_in_orders: f64,
    pub last_order_at: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ClientPaymentItem {
    pub id: i64,
    pub order_id: i64,
    pub order_number: String,
    pub amount: f64,
    pub payment_method: String,
    pub account_id: i64,
    pub notes: Option<String>,
    pub paid_at: String,
}

#[derive(Debug, Serialize)]
pub struct ClientDeliveryItem {
    pub id: i64,
    pub order_id: i64,
    pub order_number: String,
    pub delivered_by: Option<String>,
    pub notes: Option<String>,
    pub delivered_at: String,
}

#[derive(Debug, Serialize)]
pub struct ClientNote {
    pub id: i64,
    pub client_id: i64,
    pub text: String,
    pub created_at: String,
    pub updated_at: String,
}

// ── Summary ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_client_card_summary(
    db: State<DbState>,
    client_id: i64,
) -> Result<ClientCardSummary, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Single aggregate query. Active = draft/in_work/ready.
    // Revenue and avg_check exclude cancelled orders.
    // Debt sums positive remainder on non-cancelled orders.
    let row = conn
        .query_row(
            "SELECT
                COUNT(CASE WHEN production_status != 'cancelled' THEN 1 END),
                COUNT(CASE WHEN production_status IN ('draft','in_work','ready') THEN 1 END),
                COUNT(CASE WHEN production_status = 'cancelled' THEN 1 END),
                COALESCE(SUM(CASE WHEN production_status != 'cancelled' THEN total_amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN production_status != 'cancelled'
                    AND total_amount > paid_amount THEN total_amount - paid_amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN production_status != 'cancelled'
                    AND paid_amount > total_amount THEN paid_amount - total_amount ELSE 0 END), 0),
                MAX(CASE WHEN production_status != 'cancelled' THEN created_at END)
             FROM orders WHERE client_id = ?1",
            rusqlite::params![client_id],
            |row| {
                let orders_total: i64 = row.get(0)?;
                let orders_active: i64 = row.get(1)?;
                let orders_cancelled: i64 = row.get(2)?;
                let revenue: f64 = row.get(3)?;
                let current_debt: f64 = row.get(4)?;
                let overpaid_in_orders: f64 = row.get(5)?;
                let last_order_at: Option<String> = row.get(6)?;
                let avg_check = if orders_total > 0 {
                    revenue / orders_total as f64
                } else {
                    0.0
                };
                Ok(ClientCardSummary {
                    orders_total,
                    orders_active,
                    orders_cancelled,
                    revenue,
                    avg_check,
                    current_debt,
                    overpaid_in_orders,
                    last_order_at,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(row)
}

// ── Payments across all client orders ────────────────────────────────

#[tauri::command]
pub fn list_client_payments(
    db: State<DbState>,
    client_id: i64,
) -> Result<Vec<ClientPaymentItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.order_id, o.number, p.amount, p.payment_method,
                    p.account_id, p.notes, p.paid_at
             FROM order_payments p
             JOIN orders o ON o.id = p.order_id
             WHERE o.client_id = ?1 AND p.voided_at IS NULL
             ORDER BY p.paid_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![client_id], |row| {
            Ok(ClientPaymentItem {
                id: row.get(0)?,
                order_id: row.get(1)?,
                order_number: row.get(2)?,
                amount: row.get(3)?,
                payment_method: row.get(4)?,
                account_id: row.get(5)?,
                notes: row.get(6)?,
                paid_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

// ── Deliveries across all client orders ──────────────────────────────

#[tauri::command]
pub fn list_client_deliveries(
    db: State<DbState>,
    client_id: i64,
) -> Result<Vec<ClientDeliveryItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT d.id, d.order_id, o.number, d.delivered_by, d.notes, d.delivered_at
             FROM order_deliveries d
             JOIN orders o ON o.id = d.order_id
             WHERE o.client_id = ?1
             ORDER BY d.delivered_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![client_id], |row| {
            Ok(ClientDeliveryItem {
                id: row.get(0)?,
                order_id: row.get(1)?,
                order_number: row.get(2)?,
                delivered_by: row.get(3)?,
                notes: row.get(4)?,
                delivered_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

// ── Notes CRUD ───────────────────────────────────────────────────────

fn row_to_note(row: &rusqlite::Row) -> rusqlite::Result<ClientNote> {
    Ok(ClientNote {
        id: row.get(0)?,
        client_id: row.get(1)?,
        text: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

#[tauri::command]
pub fn list_client_notes(
    db: State<DbState>,
    client_id: i64,
) -> Result<Vec<ClientNote>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, client_id, text, created_at, updated_at
             FROM client_notes WHERE client_id = ?1
             ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![client_id], row_to_note)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[derive(Debug, Deserialize)]
pub struct CreateClientNoteInput {
    pub client_id: i64,
    pub text: String,
}

#[tauri::command]
pub fn create_client_note(
    db: State<DbState>,
    input: CreateClientNoteInput,
) -> Result<ClientNote, String> {
    let text = input.text.trim();
    if text.is_empty() {
        return Err("Текст заметки не может быть пустым".to_string());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let _: i64 = conn
        .query_row(
            "SELECT id FROM clients WHERE id = ?1",
            rusqlite::params![input.client_id],
            |row| row.get(0),
        )
        .map_err(|_| "Клиент не найден".to_string())?;

    conn.execute(
        "INSERT INTO client_notes (client_id, text) VALUES (?1, ?2)",
        rusqlite::params![input.client_id, text],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, client_id, text, created_at, updated_at FROM client_notes WHERE id = ?1",
        rusqlite::params![id],
        row_to_note,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_client_note(
    db: State<DbState>,
    id: i64,
    text: String,
) -> Result<ClientNote, String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("Текст заметки не может быть пустым".to_string());
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "UPDATE client_notes SET text = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![trimmed, id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Заметка не найдена".to_string());
    }

    conn.query_row(
        "SELECT id, client_id, text, created_at, updated_at FROM client_notes WHERE id = ?1",
        rusqlite::params![id],
        row_to_note,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_client_note(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM client_notes WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Заметка не найдена".to_string());
    }
    Ok(())
}

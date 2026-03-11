use serde::{Deserialize, Serialize};
use rusqlite::Connection;
use tauri::State;

use crate::db::DbState;

// ── DTOs ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductionQueueItem {
    pub order_item_id: i64,
    pub order_id: i64,
    pub order_number: String,
    pub client_name: String,
    pub item_kind: String,
    pub description: Option<String>,
    pub qty: i32,
    pub production_step: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProductionLogEntry {
    pub id: i64,
    pub from_step: String,
    pub to_step: String,
    pub changed_at: String,
}

// ── Step chain logic ─────────────────────────────────────────────────

fn valid_steps(item_kind: &str) -> &'static [&'static str] {
    match item_kind {
        "book" => &["pending", "printed", "assembled", "done"],
        "print" => &["pending", "printed", "done"],
        "service" => &["pending", "done"],
        "extra" => &["pending", "done"],
        _ => &["pending", "done"],
    }
}

fn next_step(item_kind: &str, current: &str) -> Option<&'static str> {
    let steps = valid_steps(item_kind);
    let pos = steps.iter().position(|&s| s == current)?;
    steps.get(pos + 1).copied()
}

// ── Auto-complete order when all items done ──────────────────────────

pub fn maybe_auto_complete_order(conn: &Connection, order_id: i64) -> Result<(), String> {
    // Check current order status
    let status: String = conn
        .query_row(
            "SELECT production_status FROM orders WHERE id = ?1",
            rusqlite::params![order_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if status != "in_work" && status != "confirmed" {
        return Ok(());
    }

    // Count non-cancelled items not yet done
    let remaining: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM order_items
             WHERE order_id = ?1 AND is_cancelled = 0 AND production_step != 'done'",
            rusqlite::params![order_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Count total non-cancelled items (don't auto-complete empty orders)
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM order_items WHERE order_id = ?1 AND is_cancelled = 0",
            rusqlite::params![order_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if remaining == 0 && total > 0 {
        conn.execute(
            "UPDATE orders SET production_status = 'ready', updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![order_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ── Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn advance_production_step(
    db: State<DbState>,
    item_id: i64,
) -> Result<super::order_items::OrderItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Read item
    let (order_id, item_kind, current_step, is_cancelled): (i64, String, String, bool) = conn
        .query_row(
            "SELECT order_id, item_kind, production_step, is_cancelled
             FROM order_items WHERE id = ?1",
            rusqlite::params![item_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| e.to_string())?;

    if is_cancelled {
        return Err("Нельзя продвигать отменённую позицию".to_string());
    }

    // Check order status
    let order_status: String = conn
        .query_row(
            "SELECT production_status FROM orders WHERE id = ?1",
            rusqlite::params![order_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if order_status == "draft" {
        return Err("Заказ ещё не подтверждён".to_string());
    }
    if order_status == "cancelled" {
        return Err("Заказ отменён".to_string());
    }

    // Compute next step
    let next = next_step(&item_kind, &current_step)
        .ok_or_else(|| "Позиция уже завершена".to_string())?;

    // Auto-transition order confirmed → in_work
    if order_status == "confirmed" {
        conn.execute(
            "UPDATE orders SET production_status = 'in_work', updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![order_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Advance step
    conn.execute(
        "UPDATE order_items SET production_step = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![next, item_id],
    )
    .map_err(|e| e.to_string())?;

    // Log transition
    conn.execute(
        "INSERT INTO production_log (order_item_id, from_step, to_step) VALUES (?1, ?2, ?3)",
        rusqlite::params![item_id, current_step, next],
    )
    .map_err(|e| e.to_string())?;

    // Auto-complete order if all items done
    if next == "done" {
        maybe_auto_complete_order(&conn, order_id)?;
    }

    // Return updated item
    super::order_items::read_order_item_pub(&conn, item_id)
}

#[tauri::command]
pub fn list_production_queue(
    db: State<DbState>,
    queue: String,
) -> Result<Vec<ProductionQueueItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (kind_filter, step_filter) = match queue.as_str() {
        "print" => (
            "oi.item_kind IN ('book', 'print')",
            "oi.production_step = 'pending'",
        ),
        "assembly" => (
            "oi.item_kind = 'book'",
            "oi.production_step = 'printed'",
        ),
        _ => return Err(format!("Неизвестная очередь: {queue}")),
    };

    let sql = format!(
        "SELECT oi.id, o.id, o.number,
                COALESCE(c.name, 'Без клиента'), oi.item_kind,
                oi.description, oi.qty, oi.production_step, oi.created_at
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         LEFT JOIN clients c ON c.id = o.client_id
         WHERE {kind_filter} AND {step_filter}
           AND oi.is_cancelled = 0
           AND o.production_status IN ('confirmed', 'in_work')
         ORDER BY o.created_at ASC"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ProductionQueueItem {
                order_item_id: row.get(0)?,
                order_id: row.get(1)?,
                order_number: row.get(2)?,
                client_name: row.get(3)?,
                item_kind: row.get(4)?,
                description: row.get(5)?,
                qty: row.get(6)?,
                production_step: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn list_production_log(
    db: State<DbState>,
    item_id: i64,
) -> Result<Vec<ProductionLogEntry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, from_step, to_step, changed_at
             FROM production_log WHERE order_item_id = ?1
             ORDER BY changed_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![item_id], |row| {
            Ok(ProductionLogEntry {
                id: row.get(0)?,
                from_step: row.get(1)?,
                to_step: row.get(2)?,
                changed_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

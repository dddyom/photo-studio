use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;

// ── DTOs ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Order {
    pub id: i64,
    pub number: String,
    pub client_id: i64,
    pub client_name: Option<String>,
    pub pricing_program_id: Option<i64>,
    pub production_status: String,
    pub payment_status: String,
    pub delivery_status: String,
    pub total_amount: f64,
    pub paid_amount: f64,
    pub debt_amount: f64,
    pub notes: Option<String>,
    pub due_date: Option<String>,
    pub folder_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrderInput {
    pub client_id: i64,
    pub pricing_program_id: Option<i64>,
    pub notes: Option<String>,
    pub due_date: Option<String>,
    pub folder_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderInput {
    pub notes: Option<String>,
    pub due_date: Option<String>,
    pub folder_path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OrderListFilter {
    pub client_id: Option<i64>,
    pub production_status: Option<String>,
    pub payment_status: Option<String>,
    pub delivery_status: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub unpaid_only: Option<bool>,
    pub delivered_but_unpaid: Option<bool>,
    /// When false (default), cancelled orders are hidden unless the caller
    /// explicitly filters by production_status='cancelled'.
    pub include_cancelled: Option<bool>,
}

// ── Helpers ──────────────────────────────────────────────────────────

fn read_order(conn: &Connection, id: i64) -> Result<Order, String> {
    conn.query_row(
        "SELECT o.id, o.number, o.client_id, c.name, o.pricing_program_id,
                o.production_status, o.payment_status, o.delivery_status,
                o.total_amount, o.paid_amount, o.notes, o.due_date,
                o.folder_path, o.created_at, o.updated_at
         FROM orders o
         LEFT JOIN clients c ON c.id = o.client_id
         WHERE o.id = ?1",
        rusqlite::params![id],
        |row| {
            let total: f64 = row.get(8)?;
            let paid: f64 = row.get(9)?;
            Ok(Order {
                id: row.get(0)?,
                number: row.get(1)?,
                client_id: row.get(2)?,
                client_name: row.get(3)?,
                pricing_program_id: row.get(4)?,
                production_status: row.get(5)?,
                payment_status: row.get(6)?,
                delivery_status: row.get(7)?,
                total_amount: total,
                paid_amount: paid,
                debt_amount: (total - paid).max(0.0),
                notes: row.get(10)?,
                due_date: row.get(11)?,
                folder_path: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

/// Generate next order number in format YYMM-NNN.
fn generate_order_number(conn: &Connection) -> Result<String, String> {
    let now = chrono::Local::now();
    let prefix = now.format("%y%m").to_string();

    let max_num: Option<String> = conn
        .query_row(
            "SELECT number FROM orders WHERE number LIKE ?1 ORDER BY number DESC LIMIT 1",
            rusqlite::params![format!("{prefix}-%")],
            |row| row.get(0),
        )
        .ok();

    let next = match max_num {
        Some(ref num) => {
            let parts: Vec<&str> = num.split('-').collect();
            let n: i32 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
            n + 1
        }
        None => 1,
    };

    Ok(format!("{prefix}-{next:03}"))
}

/// Recalculate order total_amount from non-cancelled items.
pub(crate) fn recalculate_order_total(conn: &Connection, order_id: i64) -> Result<(), String> {
    conn.execute(
        "UPDATE orders SET
            total_amount = COALESCE((
                SELECT SUM(total_price) FROM order_items
                WHERE order_id = ?1 AND is_cancelled = 0
            ), 0),
            updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![order_id],
    )
    .map_err(|e| e.to_string())?;

    recompute_payment_status(conn, order_id)
}

/// Recompute payment_status from paid_amount vs total_amount.
pub(crate) fn recompute_payment_status(conn: &Connection, order_id: i64) -> Result<(), String> {
    let (total, paid): (f64, f64) = conn
        .query_row(
            "SELECT total_amount, paid_amount FROM orders WHERE id = ?1",
            rusqlite::params![order_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let status = if paid <= 0.0 {
        "unpaid"
    } else if paid > total && total > 0.0 {
        "overpaid"
    } else if (paid - total).abs() < 0.01 {
        "paid"
    } else {
        "partial"
    };

    conn.execute(
        "UPDATE orders SET payment_status = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![status, order_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn create_order(db: State<DbState>, input: CreateOrderInput) -> Result<Order, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Validate client exists
    let _: i64 = conn
        .query_row(
            "SELECT id FROM clients WHERE id = ?1",
            rusqlite::params![input.client_id],
            |row| row.get(0),
        )
        .map_err(|_| "Клиент не найден".to_string())?;

    // Resolve pricing program: explicit > client default > none
    let pricing_program_id: Option<i64> = match input.pricing_program_id {
        Some(id) => Some(id),
        None => conn
            .query_row(
                "SELECT default_pricing_program_id FROM clients WHERE id = ?1",
                rusqlite::params![input.client_id],
                |row| row.get(0),
            )
            .ok()
            .flatten(),
    };

    let number = generate_order_number(&conn)?;

    conn.execute(
        "INSERT INTO orders (number, client_id, pricing_program_id, notes, due_date, folder_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![number, input.client_id, pricing_program_id, input.notes, input.due_date, input.folder_path],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    read_order(&conn, id)
}

#[tauri::command]
pub fn get_order(db: State<DbState>, id: i64) -> Result<Order, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    read_order(&conn, id)
}

#[tauri::command]
pub fn update_order(
    db: State<DbState>,
    id: i64,
    input: UpdateOrderInput,
) -> Result<Order, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let order = read_order(&conn, id)?;

    if order.production_status == "cancelled" {
        return Err("Нельзя редактировать отменённый заказ".to_string());
    }

    // due_date only editable in draft
    let due_date = if order.production_status == "draft" {
        input.due_date
    } else {
        order.due_date
    };

    conn.execute(
        "UPDATE orders SET notes = ?1, due_date = ?2, folder_path = ?3, updated_at = datetime('now')
         WHERE id = ?4",
        rusqlite::params![input.notes, due_date, input.folder_path, id],
    )
    .map_err(|e| e.to_string())?;

    read_order(&conn, id)
}

#[tauri::command]
pub fn confirm_order(db: State<DbState>, id: i64) -> Result<Order, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let order = read_order(&conn, id)?;

    if order.production_status != "draft" {
        return Err("Начать можно только черновик".to_string());
    }

    conn.execute(
        "UPDATE orders SET production_status = 'in_work', updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    read_order(&conn, id)
}

#[tauri::command]
pub fn cancel_order(db: State<DbState>, id: i64) -> Result<Order, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let order = read_order(&conn, id)?;

    if !matches!(
        order.production_status.as_str(),
        "draft" | "confirmed" | "in_work"
    ) {
        return Err(format!(
            "Отмена невозможна из статуса '{}'",
            order.production_status
        ));
    }

    conn.execute(
        "UPDATE orders SET production_status = 'cancelled', updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    read_order(&conn, id)
}

#[tauri::command]
pub fn update_production_status(
    db: State<DbState>,
    id: i64,
    status: String,
) -> Result<Order, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let order = read_order(&conn, id)?;

    // Validate transition
    let valid = match (order.production_status.as_str(), status.as_str()) {
        ("draft", "in_work") => true,
        ("in_work", "ready") => true,
        ("ready", "closed") => true,
        ("draft" | "in_work", "cancelled") => true,
        // Legacy: allow confirmed → in_work/ready/cancelled
        ("confirmed", "in_work" | "ready" | "cancelled") => true,
        _ => false,
    };

    if !valid {
        return Err(format!(
            "Переход '{}' → '{}' недопустим",
            order.production_status, status
        ));
    }

    conn.execute(
        "UPDATE orders SET production_status = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![status, id],
    )
    .map_err(|e| e.to_string())?;

    // When setting order to "ready", mark all non-cancelled items as "done"
    if status == "ready" {
        conn.execute(
            "UPDATE order_items SET production_step = 'done', updated_at = datetime('now')
             WHERE order_id = ?1 AND is_cancelled = 0 AND production_step != 'done'",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
    }

    read_order(&conn, id)
}

#[tauri::command]
pub fn update_delivery_status(
    db: State<DbState>,
    id: i64,
    status: String,
) -> Result<Order, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let order = read_order(&conn, id)?;

    if order.production_status == "draft" || order.production_status == "cancelled" {
        return Err("Изменение статуса выдачи недоступно для черновика/отменённого заказа".to_string());
    }

    let valid_statuses = ["not_delivered", "partially_delivered", "delivered"];
    if !valid_statuses.contains(&status.as_str()) {
        return Err(format!("Недопустимый статус выдачи: {status}"));
    }

    conn.execute(
        "UPDATE orders SET delivery_status = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![status, id],
    )
    .map_err(|e| e.to_string())?;

    read_order(&conn, id)
}

#[tauri::command]
pub fn delete_order(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    let result = delete_order_body(&conn, id);
    if result.is_ok() {
        tx.commit().map_err(|e| e.to_string())?;
    }
    result
}

// Hard-delete an order. Allowed only for draft/cancelled orders with no
// financial trace — payments, refunds, deliveries, production log, or
// linked client-balance transactions block deletion (caller must void those
// in the finance journal first). Deletion cascades to order_items and their
// per-kind detail rows.
fn delete_order_body(conn: &Connection, id: i64) -> Result<(), String> {
    let status: String = conn
        .query_row(
            "SELECT production_status FROM orders WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Заказ не найден".to_string())?;

    if !matches!(status.as_str(), "draft" | "cancelled") {
        return Err(format!(
            "Удалять можно только черновики или отменённые заказы (текущий статус: {status}). \
             Сначала отмените заказ."
        ));
    }

    // Block when any financial trace exists. We check non-voided rows only —
    // voided ones don't affect balances, so they're safe to wipe with the order.
    let has_payments: bool = conn
        .query_row(
            "SELECT 1 FROM order_payments WHERE order_id = ?1 AND voided_at IS NULL LIMIT 1",
            rusqlite::params![id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if has_payments {
        return Err(
            "У заказа есть оплаты. Сначала отмените их в журнале финансов.".to_string(),
        );
    }

    let has_refunds: bool = conn
        .query_row(
            "SELECT 1 FROM order_refunds WHERE order_id = ?1 AND voided_at IS NULL LIMIT 1",
            rusqlite::params![id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if has_refunds {
        return Err(
            "У заказа есть возвраты. Сначала отмените их в журнале финансов.".to_string(),
        );
    }

    let has_deliveries: bool = conn
        .query_row(
            "SELECT 1 FROM order_deliveries WHERE order_id = ?1 LIMIT 1",
            rusqlite::params![id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if has_deliveries {
        return Err("У заказа есть отметки выдачи — удаление недоступно.".to_string());
    }

    let has_balance_tx: bool = conn
        .query_row(
            "SELECT 1 FROM client_balance_transactions
             WHERE order_id = ?1 AND voided_at IS NULL LIMIT 1",
            rusqlite::params![id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if has_balance_tx {
        return Err(
            "По заказу были операции с балансом клиента. Сначала отмените их.".to_string(),
        );
    }

    let has_production_log: bool = conn
        .query_row(
            "SELECT 1 FROM production_log pl
             JOIN order_items oi ON oi.id = pl.order_item_id
             WHERE oi.order_id = ?1 LIMIT 1",
            rusqlite::params![id],
            |_| Ok(true),
        )
        .unwrap_or(false);
    if has_production_log {
        return Err("По заказу был запущен производственный процесс — удаление недоступно.".to_string());
    }

    // Cascade delete: per-item detail tables → items → voided payments/refunds/balance tx → order
    conn.execute(
        "DELETE FROM order_item_books WHERE order_item_id IN
            (SELECT id FROM order_items WHERE order_id = ?1)",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM order_item_prints WHERE order_item_id IN
            (SELECT id FROM order_items WHERE order_id = ?1)",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM order_item_extras WHERE order_item_id IN
            (SELECT id FROM order_items WHERE order_id = ?1)",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM order_items WHERE order_id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    // Voided rows (passed the checks above) get wiped along with the order
    conn.execute(
        "DELETE FROM order_payments WHERE order_id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM order_refunds WHERE order_id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM client_balance_transactions WHERE order_id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;
    // finance_transactions referencing this order: NULL out order_id so the
    // history record stays intact (though it shouldn't exist non-voided here)
    conn.execute(
        "UPDATE finance_transactions SET order_id = NULL WHERE order_id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM orders WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn list_orders(db: State<DbState>, filter: OrderListFilter) -> Result<Vec<Order>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut conditions: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(client_id) = filter.client_id {
        conditions.push(format!("o.client_id = ?{idx}"));
        params.push(Box::new(client_id));
        idx += 1;
    }

    if let Some(ref ps) = filter.production_status {
        conditions.push(format!("o.production_status = ?{idx}"));
        params.push(Box::new(ps.clone()));
        idx += 1;
    }

    if let Some(ref ps) = filter.payment_status {
        conditions.push(format!("o.payment_status = ?{idx}"));
        params.push(Box::new(ps.clone()));
        idx += 1;
    }

    if let Some(ref ds) = filter.delivery_status {
        conditions.push(format!("o.delivery_status = ?{idx}"));
        params.push(Box::new(ds.clone()));
        idx += 1;
    }

    if let Some(ref date_from) = filter.date_from {
        conditions.push(format!("o.created_at >= ?{idx}"));
        params.push(Box::new(date_from.clone()));
        idx += 1;
    }

    if let Some(ref date_to) = filter.date_to {
        conditions.push(format!("o.created_at <= ?{idx}"));
        params.push(Box::new(date_to.clone()));
        #[allow(unused_assignments)]
        { idx += 1; }
    }

    if filter.unpaid_only == Some(true) {
        conditions.push("o.payment_status IN ('unpaid', 'partial')".to_string());
    }

    if filter.delivered_but_unpaid == Some(true) {
        conditions.push("o.delivery_status = 'delivered'".to_string());
        conditions.push("o.payment_status IN ('unpaid', 'partial')".to_string());
    }

    // Hide cancelled by default unless caller asked for them or filtered explicitly
    let explicit_cancelled = filter.production_status.as_deref() == Some("cancelled");
    if !explicit_cancelled && !filter.include_cancelled.unwrap_or(false) {
        conditions.push("o.production_status != 'cancelled'".to_string());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT o.id, o.number, o.client_id, c.name, o.pricing_program_id,
                o.production_status, o.payment_status, o.delivery_status,
                o.total_amount, o.paid_amount, o.notes, o.due_date,
                o.folder_path, o.created_at, o.updated_at
         FROM orders o
         LEFT JOIN clients c ON c.id = o.client_id
         {where_clause}
         ORDER BY o.created_at DESC"
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            let total: f64 = row.get(8)?;
            let paid: f64 = row.get(9)?;
            Ok(Order {
                id: row.get(0)?,
                number: row.get(1)?,
                client_id: row.get(2)?,
                client_name: row.get(3)?,
                pricing_program_id: row.get(4)?,
                production_status: row.get(5)?,
                payment_status: row.get(6)?,
                delivery_status: row.get(7)?,
                total_amount: total,
                paid_amount: paid,
                debt_amount: (total - paid).max(0.0),
                notes: row.get(10)?,
                due_date: row.get(11)?,
                folder_path: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

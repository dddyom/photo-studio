use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::orders::recompute_payment_status;
use crate::db::DbState;

// ── DTOs ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderPayment {
    pub id: i64,
    pub order_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub account_id: i64,
    pub finance_transaction_id: Option<i64>,
    pub notes: Option<String>,
    pub paid_at: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderRefund {
    pub id: i64,
    pub order_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub account_id: i64,
    pub finance_transaction_id: Option<i64>,
    pub reason: Option<String>,
    pub refunded_at: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderDelivery {
    pub id: i64,
    pub order_id: i64,
    pub delivered_by: Option<String>,
    pub notes: Option<String>,
    pub delivered_at: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPaymentInput {
    pub order_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub account_id: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRefundInput {
    pub order_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub account_id: i64,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterDeliveryInput {
    pub order_id: i64,
    pub delivered_by: Option<String>,
    pub notes: Option<String>,
}

// ── Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn register_payment(
    db: State<DbState>,
    input: RegisterPaymentInput,
) -> Result<OrderPayment, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 {
        return Err("Сумма оплаты должна быть > 0".to_string());
    }

    let valid_methods = ["cash", "card", "bank_transfer"];
    if !valid_methods.contains(&input.payment_method.as_str()) {
        return Err(format!(
            "Недопустимый метод оплаты: {}",
            input.payment_method
        ));
    }

    // Check order exists and not cancelled
    let prod_status: String = conn
        .query_row(
            "SELECT production_status FROM orders WHERE id = ?1",
            rusqlite::params![input.order_id],
            |row| row.get(0),
        )
        .map_err(|_| "Заказ не найден".to_string())?;

    if prod_status == "cancelled" {
        return Err("Нельзя принять оплату по отменённому заказу".to_string());
    }

    // Get order number for finance description
    let order_number: String = conn
        .query_row(
            "SELECT number FROM orders WHERE id = ?1",
            rusqlite::params![input.order_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // 1. Create finance transaction
    conn.execute(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, order_id, description, transaction_date)
         VALUES ('order_payment_in', ?1, 'in', ?2, ?3, ?4, date('now'))",
        rusqlite::params![
            input.amount,
            input.account_id,
            input.order_id,
            format!("Оплата заказа {order_number}"),
        ],
    )
    .map_err(|e| e.to_string())?;

    let fin_tx_id = conn.last_insert_rowid();

    // 2. Update account balance
    conn.execute(
        "UPDATE company_accounts SET balance = balance + ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    // 3. Insert payment record
    conn.execute(
        "INSERT INTO order_payments (order_id, amount, payment_method, account_id,
            finance_transaction_id, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            input.order_id,
            input.amount,
            input.payment_method,
            input.account_id,
            fin_tx_id,
            input.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    let payment_id = conn.last_insert_rowid();

    // 4. Update order paid_amount
    conn.execute(
        "UPDATE orders SET paid_amount = paid_amount + ?1, updated_at = datetime('now')
         WHERE id = ?2",
        rusqlite::params![input.amount, input.order_id],
    )
    .map_err(|e| e.to_string())?;

    // 5. Recompute payment status
    recompute_payment_status(&conn, input.order_id)?;

    // Return payment record
    conn.query_row(
        "SELECT id, order_id, amount, payment_method, account_id,
                finance_transaction_id, notes, paid_at, created_at
         FROM order_payments WHERE id = ?1",
        rusqlite::params![payment_id],
        |row| {
            Ok(OrderPayment {
                id: row.get(0)?,
                order_id: row.get(1)?,
                amount: row.get(2)?,
                payment_method: row.get(3)?,
                account_id: row.get(4)?,
                finance_transaction_id: row.get(5)?,
                notes: row.get(6)?,
                paid_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn register_refund(
    db: State<DbState>,
    input: RegisterRefundInput,
) -> Result<OrderRefund, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 {
        return Err("Сумма возврата должна быть > 0".to_string());
    }

    let valid_methods = ["cash", "card", "bank_transfer"];
    if !valid_methods.contains(&input.payment_method.as_str()) {
        return Err(format!(
            "Недопустимый метод оплаты: {}",
            input.payment_method
        ));
    }

    // Check order exists and has enough paid_amount
    let (paid_amount, order_number): (f64, String) = conn
        .query_row(
            "SELECT paid_amount, number FROM orders WHERE id = ?1",
            rusqlite::params![input.order_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Заказ не найден".to_string())?;

    if input.amount > paid_amount + 0.01 {
        return Err(format!(
            "Сумма возврата ({}) превышает оплаченную сумму ({})",
            input.amount, paid_amount
        ));
    }

    // 1. Create finance transaction
    conn.execute(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, order_id, description, transaction_date)
         VALUES ('order_refund_out', ?1, 'out', ?2, ?3, ?4, date('now'))",
        rusqlite::params![
            input.amount,
            input.account_id,
            input.order_id,
            format!("Возврат по заказу {order_number}"),
        ],
    )
    .map_err(|e| e.to_string())?;

    let fin_tx_id = conn.last_insert_rowid();

    // 2. Update account balance
    conn.execute(
        "UPDATE company_accounts SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    // 3. Insert refund record
    conn.execute(
        "INSERT INTO order_refunds (order_id, amount, payment_method, account_id,
            finance_transaction_id, reason)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![
            input.order_id,
            input.amount,
            input.payment_method,
            input.account_id,
            fin_tx_id,
            input.reason,
        ],
    )
    .map_err(|e| e.to_string())?;

    let refund_id = conn.last_insert_rowid();

    // 4. Update order paid_amount
    conn.execute(
        "UPDATE orders SET paid_amount = paid_amount - ?1, updated_at = datetime('now')
         WHERE id = ?2",
        rusqlite::params![input.amount, input.order_id],
    )
    .map_err(|e| e.to_string())?;

    // 5. Recompute payment status
    recompute_payment_status(&conn, input.order_id)?;

    conn.query_row(
        "SELECT id, order_id, amount, payment_method, account_id,
                finance_transaction_id, reason, refunded_at, created_at
         FROM order_refunds WHERE id = ?1",
        rusqlite::params![refund_id],
        |row| {
            Ok(OrderRefund {
                id: row.get(0)?,
                order_id: row.get(1)?,
                amount: row.get(2)?,
                payment_method: row.get(3)?,
                account_id: row.get(4)?,
                finance_transaction_id: row.get(5)?,
                reason: row.get(6)?,
                refunded_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn register_delivery(
    db: State<DbState>,
    input: RegisterDeliveryInput,
) -> Result<OrderDelivery, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Validate order status
    let prod_status: String = conn
        .query_row(
            "SELECT production_status FROM orders WHERE id = ?1",
            rusqlite::params![input.order_id],
            |row| row.get(0),
        )
        .map_err(|_| "Заказ не найден".to_string())?;

    if matches!(prod_status.as_str(), "draft" | "cancelled") {
        return Err("Выдача недоступна для черновика/отменённого заказа".to_string());
    }

    conn.execute(
        "INSERT INTO order_deliveries (order_id, delivered_by, notes)
         VALUES (?1, ?2, ?3)",
        rusqlite::params![input.order_id, input.delivered_by, input.notes],
    )
    .map_err(|e| e.to_string())?;

    let delivery_id = conn.last_insert_rowid();

    // Auto-set delivery_status to 'delivered'
    conn.execute(
        "UPDATE orders SET delivery_status = 'delivered', updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![input.order_id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, order_id, delivered_by, notes, delivered_at, created_at
         FROM order_deliveries WHERE id = ?1",
        rusqlite::params![delivery_id],
        |row| {
            Ok(OrderDelivery {
                id: row.get(0)?,
                order_id: row.get(1)?,
                delivered_by: row.get(2)?,
                notes: row.get(3)?,
                delivered_at: row.get(4)?,
                created_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_order_payments(
    db: State<DbState>,
    order_id: i64,
) -> Result<Vec<OrderPayment>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, amount, payment_method, account_id,
                    finance_transaction_id, notes, paid_at, created_at
             FROM order_payments WHERE order_id = ?1 ORDER BY paid_at",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![order_id], |row| {
            Ok(OrderPayment {
                id: row.get(0)?,
                order_id: row.get(1)?,
                amount: row.get(2)?,
                payment_method: row.get(3)?,
                account_id: row.get(4)?,
                finance_transaction_id: row.get(5)?,
                notes: row.get(6)?,
                paid_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn list_order_refunds(db: State<DbState>, order_id: i64) -> Result<Vec<OrderRefund>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, amount, payment_method, account_id,
                    finance_transaction_id, reason, refunded_at, created_at
             FROM order_refunds WHERE order_id = ?1 ORDER BY refunded_at",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![order_id], |row| {
            Ok(OrderRefund {
                id: row.get(0)?,
                order_id: row.get(1)?,
                amount: row.get(2)?,
                payment_method: row.get(3)?,
                account_id: row.get(4)?,
                finance_transaction_id: row.get(5)?,
                reason: row.get(6)?,
                refunded_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn list_order_deliveries(
    db: State<DbState>,
    order_id: i64,
) -> Result<Vec<OrderDelivery>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, delivered_by, notes, delivered_at, created_at
             FROM order_deliveries WHERE order_id = ?1 ORDER BY delivered_at",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![order_id], |row| {
            Ok(OrderDelivery {
                id: row.get(0)?,
                order_id: row.get(1)?,
                delivered_by: row.get(2)?,
                notes: row.get(3)?,
                delivered_at: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

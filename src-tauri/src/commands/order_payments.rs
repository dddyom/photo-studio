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
    /// Set to true to confirm a payment that looks like an accidental duplicate
    /// (same order, amount and method entered minutes earlier).
    pub force: Option<bool>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterPaymentResult {
    pub payment: OrderPayment,
    pub surplus_to_balance: f64,
}

// ── Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn register_payment(
    db: State<DbState>,
    input: RegisterPaymentInput,
) -> Result<RegisterPaymentResult, String> {
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

    // Guard against an accidental duplicate: the same amount + method on this
    // order, entered in the last 10 minutes. This is exactly how a phantom 40 000
    // payment crept into the books. Require confirmation to proceed.
    if !input.force.unwrap_or(false) {
        let dup: bool = conn
            .query_row(
                "SELECT 1 FROM order_payments
                 WHERE order_id = ?1 AND ABS(amount - ?2) < 0.01 AND payment_method = ?3
                   AND voided_at IS NULL
                   AND created_at >= datetime('now', '-10 minutes')
                 LIMIT 1",
                rusqlite::params![input.order_id, input.amount, input.payment_method],
                |_| Ok(true),
            )
            .unwrap_or(false);
        if dup {
            return Err(format!(
                "Похоже на повтор: такой платёж ({:.0}, {}) по этому заказу уже вносили только что. Это точно ещё одна оплата? Подтвердите.",
                input.amount, input.payment_method
            ));
        }
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

    // 3. Get order totals to check for surplus (before insert, to set surplus_to_balance)
    let (total_amount, paid_before, client_id): (f64, f64, i64) = conn
        .query_row(
            "SELECT total_amount, paid_amount, client_id FROM orders WHERE id = ?1",
            rusqlite::params![input.order_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let paid_after = paid_before + input.amount;
    let surplus = if paid_after > total_amount && total_amount > 0.0 {
        let overpay = paid_after - total_amount;
        let prev_overpay = (paid_before - total_amount).max(0.0);
        overpay - prev_overpay
    } else {
        0.0
    };

    let order_amount = input.amount - surplus;

    // 4. Insert payment record (with surplus split tracked)
    conn.execute(
        "INSERT INTO order_payments (order_id, amount, payment_method, account_id,
            finance_transaction_id, notes, surplus_to_balance)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            input.order_id,
            input.amount,
            input.payment_method,
            input.account_id,
            fin_tx_id,
            input.notes,
            surplus,
        ],
    )
    .map_err(|e| e.to_string())?;

    let payment_id = conn.last_insert_rowid();

    // 4a. Update order paid_amount (only the order-relevant portion)
    if order_amount > 0.0 {
        conn.execute(
            "UPDATE orders SET paid_amount = paid_amount + ?1, updated_at = datetime('now')
             WHERE id = ?2",
            rusqlite::params![order_amount, input.order_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // 4b. If there's surplus, deposit it to client balance (linked via payment_id)
    if surplus > 0.01 {
        crate::commands::client_balance::record_order_surplus(
            &conn, client_id, input.order_id, payment_id, surplus,
        )?;
    }

    // 5. Recompute payment status
    recompute_payment_status(&conn, input.order_id)?;

    // Return payment record + surplus info
    let payment = conn.query_row(
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
    .map_err(|e| e.to_string())?;

    Ok(RegisterPaymentResult {
        payment,
        surplus_to_balance: surplus,
    })
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

    // Выдача = заказ полностью произведён. Доводим все непогашенные позиции
    // до 'done' (с записью в production_log) и переводим заказ в 'ready'.
    let pending_items: Vec<(i64, String)> = {
        let mut stmt = conn
            .prepare(
                "SELECT id, production_step FROM order_items
                 WHERE order_id = ?1 AND is_cancelled = 0 AND production_step != 'done'",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![input.order_id], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };

    for (item_id, from_step) in &pending_items {
        conn.execute(
            "UPDATE order_items SET production_step = 'done', updated_at = datetime('now')
             WHERE id = ?1",
            rusqlite::params![item_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO production_log (order_item_id, from_step, to_step) VALUES (?1, ?2, 'done')",
            rusqlite::params![item_id, from_step],
        )
        .map_err(|e| e.to_string())?;
    }

    // Заказ в активном производстве → 'ready' (готовый/закрытый не трогаем)
    if matches!(prod_status.as_str(), "confirmed" | "in_work") {
        conn.execute(
            "UPDATE orders SET production_status = 'ready', updated_at = datetime('now')
             WHERE id = ?1",
            rusqlite::params![input.order_id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Auto-set delivery_status to 'delivered'
    conn.execute(
        "UPDATE orders SET delivery_status = 'delivered', updated_at = datetime('now')
         WHERE id = ?1",
        rusqlite::params![input.order_id],
    )
    .map_err(|e| e.to_string())?;

    // Готов + оплачен + выдан → заказ автоматически закрывается.
    crate::commands::orders::sync_auto_close(&conn, input.order_id)?;

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

/// Remove a delivery mark (e.g. it was recorded by mistake). Resets the order's
/// delivery_status to 'not_delivered' when no deliveries remain. No money is
/// attached to a delivery, so this is a plain undo.
#[tauri::command]
pub fn delete_order_delivery(db: State<DbState>, delivery_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let order_id: i64 = conn
        .query_row(
            "SELECT order_id FROM order_deliveries WHERE id = ?1",
            rusqlite::params![delivery_id],
            |row| row.get(0),
        )
        .map_err(|_| "Выдача не найдена".to_string())?;

    conn.execute(
        "DELETE FROM order_deliveries WHERE id = ?1",
        rusqlite::params![delivery_id],
    )
    .map_err(|e| e.to_string())?;

    let remaining: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM order_deliveries WHERE order_id = ?1",
            rusqlite::params![order_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let status = if remaining == 0 { "not_delivered" } else { "delivered" };
    conn.execute(
        "UPDATE orders SET delivery_status = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![status, order_id],
    )
    .map_err(|e| e.to_string())?;

    // Снятие выдачи может «расзакрыть» заказ обратно в 'ready'.
    crate::commands::orders::sync_auto_close(&conn, order_id)?;

    Ok(())
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
             FROM order_payments WHERE order_id = ?1 AND voided_at IS NULL ORDER BY paid_at",
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
             FROM order_refunds WHERE order_id = ?1 AND voided_at IS NULL ORDER BY refunded_at",
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

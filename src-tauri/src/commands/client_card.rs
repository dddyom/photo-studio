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

/// Plain-language reconciliation of a client's money, so the operator can see
/// "сходится / не сходится" at a glance instead of guessing from the balance.
#[derive(Debug, Serialize)]
pub struct ClientReconciliation {
    /// Real money the client handed over, net: order payments + balance deposits
    /// − refunds − balance withdrawals (all non-voided).
    pub cash_in: f64,
    /// Value of goods the client received (sum of non-cancelled order totals).
    pub goods: f64,
    /// Bottom line: goods − cash_in. Positive = client owes the studio,
    /// negative = the studio owes the client.
    pub net_owed: f64,
    /// Current credit sitting on the client's balance.
    pub balance: f64,
    /// Outstanding debt summed across the client's non-cancelled orders.
    pub order_debt: f64,
    /// Money stranded in overpaid orders (paid_amount > total_amount).
    pub overpaid_in_orders: f64,
    /// True when the app's own books tie out (cash_in == Σpaid + balance).
    /// False signals a broken void/restore or a manual edit — DON'T self-repair.
    pub is_consistent: bool,
    /// Size of the inconsistency, if any (for diagnostics).
    pub discrepancy: f64,
    // Breakdown for the snapshot / audit.
    pub payments: f64,
    pub refunds: f64,
    pub deposits: f64,
    pub withdrawals: f64,
}

#[tauri::command]
pub fn get_client_reconciliation(
    db: State<DbState>,
    client_id: i64,
) -> Result<ClientReconciliation, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    reconcile(&conn, client_id)
}

fn reconcile(conn: &rusqlite::Connection, client_id: i64) -> Result<ClientReconciliation, String> {
    let (payments, refunds, deposits, withdrawals, goods, sum_paid, order_debt, overpaid, balance): (
        f64, f64, f64, f64, f64, f64, f64, f64, f64,
    ) = conn
        .query_row(
            "SELECT
                COALESCE((SELECT SUM(p.amount) FROM order_payments p JOIN orders o ON o.id=p.order_id
                          WHERE o.client_id=?1 AND p.voided_at IS NULL),0),
                COALESCE((SELECT SUM(r.amount) FROM order_refunds r JOIN orders o ON o.id=r.order_id
                          WHERE o.client_id=?1 AND r.voided_at IS NULL),0),
                COALESCE((SELECT SUM(amount) FROM client_balance_transactions
                          WHERE client_id=?1 AND transaction_type='deposit' AND voided_at IS NULL),0),
                COALESCE((SELECT SUM(amount) FROM client_balance_transactions
                          WHERE client_id=?1 AND transaction_type='withdraw' AND voided_at IS NULL),0),
                COALESCE((SELECT SUM(total_amount) FROM orders
                          WHERE client_id=?1 AND production_status!='cancelled'),0),
                COALESCE((SELECT SUM(paid_amount) FROM orders WHERE client_id=?1),0),
                COALESCE((SELECT SUM(total_amount-paid_amount) FROM orders
                          WHERE client_id=?1 AND production_status!='cancelled'),0),
                COALESCE((SELECT SUM(paid_amount-total_amount) FROM orders
                          WHERE client_id=?1 AND production_status!='cancelled' AND paid_amount>total_amount),0),
                (SELECT balance FROM clients WHERE id=?1)",
            rusqlite::params![client_id],
            |row| {
                Ok((
                    row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?,
                    row.get(4)?, row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?,
                ))
            },
        )
        .map_err(|_| "Клиент не найден".to_string())?;

    let cash_in = payments - refunds + deposits - withdrawals;
    let net_owed = goods - cash_in;
    let discrepancy = cash_in - (sum_paid + balance);

    Ok(ClientReconciliation {
        cash_in,
        goods,
        net_owed,
        balance,
        order_debt,
        overpaid_in_orders: overpaid,
        is_consistent: discrepancy.abs() < 1.0,
        discrepancy,
        payments,
        refunds,
        deposits,
        withdrawals,
    })
}

/// Write a human-readable diagnostic snapshot for one client to the exports
/// folder: reconciliation + every order + recent balance/payment operations.
/// The operator sends this file to the developer instead of poking at the data.
#[tauri::command]
pub fn export_client_diagnostic(db: State<DbState>, client_id: i64) -> Result<String, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let r = reconcile(&conn, client_id)?;

    let (name, phone): (String, Option<String>) = conn
        .query_row(
            "SELECT name, phone FROM clients WHERE id = ?1",
            rusqlite::params![client_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Клиент не найден".to_string())?;

    let now = chrono::Local::now();
    let mut out = String::new();
    out.push_str("СНИМОК ПО КЛИЕНТУ ДЛЯ РАЗРАБОТЧИКА\n");
    out.push_str(&format!("Сформирован: {}\n", now.format("%Y-%m-%d %H:%M:%S")));
    out.push_str(&format!("Клиент: {} (id {}){}\n\n", name, client_id,
        phone.map(|p| format!(", тел. {p}")).unwrap_or_default()));

    out.push_str("СВЕРКА\n");
    out.push_str(&format!("  Внёс деньгами (нетто):   {:>12.2}\n", r.cash_in));
    out.push_str(&format!("    оплаты:                {:>12.2}\n", r.payments));
    out.push_str(&format!("    возвраты:              {:>12.2}\n", r.refunds));
    out.push_str(&format!("    пополнения баланса:    {:>12.2}\n", r.deposits));
    out.push_str(&format!("    выводы с баланса:      {:>12.2}\n", r.withdrawals));
    out.push_str(&format!("  Товара получил на:       {:>12.2}\n", r.goods));
    out.push_str(&format!("  => Должен студии (нетто):{:>12.2}\n", r.net_owed));
    out.push_str(&format!("  Баланс (кредит):         {:>12.2}\n", r.balance));
    out.push_str(&format!("  Долг по заказам:         {:>12.2}\n", r.order_debt));
    out.push_str(&format!("  Переплата в заказах:     {:>12.2}\n", r.overpaid_in_orders));
    out.push_str(&format!("  Книги сходятся: {}{}\n\n",
        if r.is_consistent { "ДА" } else { "НЕТ" },
        if r.is_consistent { String::new() } else { format!(" (расхождение {:.2})", r.discrepancy) }));

    out.push_str("ЗАКАЗЫ\n");
    {
        let mut stmt = conn
            .prepare(
                "SELECT number, production_status, payment_status, delivery_status,
                        total_amount, paid_amount, created_at
                 FROM orders WHERE client_id = ?1 ORDER BY id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![client_id], |row| {
                Ok((
                    row.get::<_, String>(0)?, row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?, row.get::<_, String>(3)?,
                    row.get::<_, f64>(4)?, row.get::<_, f64>(5)?, row.get::<_, String>(6)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (num, prod, pay, deliv, total, paid, created) = row.map_err(|e| e.to_string())?;
            out.push_str(&format!(
                "  {num}  {prod}/{pay}/{deliv}  сумма {total:.0} оплачено {paid:.0} долг {:.0}  ({})\n",
                total - paid, &created[..10.min(created.len())]
            ));
        }
    }

    out.push_str("\nДВИЖЕНИЯ ПО БАЛАНСУ (последние 30, вкл. отменённые)\n");
    {
        let mut stmt = conn
            .prepare(
                "SELECT bt.created_at, bt.transaction_type, bt.direction, bt.amount,
                        o.number, bt.voided_at, bt.notes
                 FROM client_balance_transactions bt
                 LEFT JOIN orders o ON o.id = bt.order_id
                 WHERE bt.client_id = ?1 ORDER BY bt.created_at DESC, bt.id DESC LIMIT 30",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![client_id], |row| {
                Ok((
                    row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?,
                    row.get::<_, f64>(3)?, row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?, row.get::<_, Option<String>>(6)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (created, ttype, dir, amount, num, voided, notes) = row.map_err(|e| e.to_string())?;
            out.push_str(&format!(
                "  {}  {ttype} {} {amount:.0}  {}{}{}\n",
                created, if dir == "in" { "+" } else { "-" },
                num.map(|n| format!("#{n} ")).unwrap_or_default(),
                if voided.is_some() { "[ОТМЕНЕНО] " } else { "" },
                notes.unwrap_or_default(),
            ));
        }
    }

    let dir = db.db_path.parent().unwrap_or(std::path::Path::new(".")).join("exports");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe_name: String = name.chars().filter(|c| c.is_alphanumeric()).collect();
    let path = dir.join(format!("диагностика_{}_{}.txt", safe_name, now.format("%Y-%m-%d_%H-%M-%S")));
    std::fs::write(&path, out).map_err(|e| e.to_string())?;

    Ok(path.display().to_string())
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

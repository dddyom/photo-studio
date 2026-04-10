use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;

// ── DTOs ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ClientWithBalance {
    pub client_id: i64,
    pub client_name: String,
    pub phone: Option<String>,
    pub balance: f64,
    pub last_transaction_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ClientBalanceTransaction {
    pub id: i64,
    pub client_id: i64,
    pub amount: f64,
    pub direction: String,
    pub transaction_type: String,
    pub order_id: Option<i64>,
    pub order_number: Option<String>,
    pub payment_method: Option<String>,
    pub account_id: Option<i64>,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DepositInput {
    pub client_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub account_id: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WithdrawInput {
    pub client_id: i64,
    pub amount: f64,
    pub payment_method: String,
    pub account_id: i64,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PayFromBalanceInput {
    pub order_id: i64,
    pub amount: f64,
    pub notes: Option<String>,
}

// ── Internal helpers ─────────────────────────────────────────────────

fn get_client_balance(conn: &rusqlite::Connection, client_id: i64) -> Result<f64, String> {
    conn.query_row(
        "SELECT balance FROM clients WHERE id = ?1",
        rusqlite::params![client_id],
        |row| row.get(0),
    )
    .map_err(|_| "Клиент не найден".to_string())
}

/// Record surplus from order overpayment onto client balance.
/// Called from register_payment when paid > total.
pub(crate) fn record_order_surplus(
    conn: &rusqlite::Connection,
    client_id: i64,
    order_id: i64,
    surplus: f64,
) -> Result<(), String> {
    // 1. Update client balance
    conn.execute(
        "UPDATE clients SET balance = balance + ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![surplus, client_id],
    )
    .map_err(|e| e.to_string())?;

    // 2. Record balance transaction
    conn.execute(
        "INSERT INTO client_balance_transactions
            (client_id, amount, direction, transaction_type, order_id, notes)
         VALUES (?1, ?2, 'in', 'order_surplus', ?3, ?4)",
        rusqlite::params![
            client_id,
            surplus,
            order_id,
            format!("Излишек по оплате заказа"),
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ── Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn deposit_to_client_balance(
    db: State<DbState>,
    input: DepositInput,
) -> Result<ClientBalanceTransaction, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 {
        return Err("Сумма пополнения должна быть > 0".to_string());
    }

    let valid_methods = ["cash", "card", "bank_transfer"];
    if !valid_methods.contains(&input.payment_method.as_str()) {
        return Err(format!("Недопустимый метод оплаты: {}", input.payment_method));
    }

    // Check client exists
    let _: i64 = conn
        .query_row(
            "SELECT id FROM clients WHERE id = ?1",
            rusqlite::params![input.client_id],
            |row| row.get(0),
        )
        .map_err(|_| "Клиент не найден".to_string())?;

    let client_name: String = conn
        .query_row(
            "SELECT name FROM clients WHERE id = ?1",
            rusqlite::params![input.client_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // 1. Create finance transaction (money comes in)
    conn.execute(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, description, transaction_date)
         VALUES ('order_payment_in', ?1, 'in', ?2, ?3, date('now'))",
        rusqlite::params![
            input.amount,
            input.account_id,
            format!("Пополнение баланса клиента {client_name}"),
        ],
    )
    .map_err(|e| e.to_string())?;

    // 2. Update company account balance
    conn.execute(
        "UPDATE company_accounts SET balance = balance + ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    // 3. Update client balance
    conn.execute(
        "UPDATE clients SET balance = balance + ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![input.amount, input.client_id],
    )
    .map_err(|e| e.to_string())?;

    // 4. Record balance transaction
    conn.execute(
        "INSERT INTO client_balance_transactions
            (client_id, amount, direction, transaction_type, payment_method, account_id, notes)
         VALUES (?1, ?2, 'in', 'deposit', ?3, ?4, ?5)",
        rusqlite::params![
            input.client_id,
            input.amount,
            input.payment_method,
            input.account_id,
            input.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    let tx_id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT bt.id, bt.client_id, bt.amount, bt.direction, bt.transaction_type,
                bt.order_id, o.number, bt.payment_method, bt.account_id, bt.notes, bt.created_at
         FROM client_balance_transactions bt
         LEFT JOIN orders o ON o.id = bt.order_id
         WHERE bt.id = ?1",
        rusqlite::params![tx_id],
        |row| {
            Ok(ClientBalanceTransaction {
                id: row.get(0)?,
                client_id: row.get(1)?,
                amount: row.get(2)?,
                direction: row.get(3)?,
                transaction_type: row.get(4)?,
                order_id: row.get(5)?,
                order_number: row.get(6)?,
                payment_method: row.get(7)?,
                account_id: row.get(8)?,
                notes: row.get(9)?,
                created_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn withdraw_from_client_balance(
    db: State<DbState>,
    input: WithdrawInput,
) -> Result<ClientBalanceTransaction, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 {
        return Err("Сумма вывода должна быть > 0".to_string());
    }

    let valid_methods = ["cash", "card", "bank_transfer"];
    if !valid_methods.contains(&input.payment_method.as_str()) {
        return Err(format!("Недопустимый метод оплаты: {}", input.payment_method));
    }

    let balance = get_client_balance(&conn, input.client_id)?;
    if input.amount > balance + 0.01 {
        return Err(format!(
            "Сумма вывода ({}) превышает баланс клиента ({})",
            input.amount, balance
        ));
    }

    let client_name: String = conn
        .query_row(
            "SELECT name FROM clients WHERE id = ?1",
            rusqlite::params![input.client_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // 1. Create finance transaction (money goes out)
    conn.execute(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, description, transaction_date)
         VALUES ('order_refund_out', ?1, 'out', ?2, ?3, date('now'))",
        rusqlite::params![
            input.amount,
            input.account_id,
            format!("Возврат с баланса клиента {client_name}"),
        ],
    )
    .map_err(|e| e.to_string())?;

    // 2. Update company account balance
    conn.execute(
        "UPDATE company_accounts SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    // 3. Update client balance
    conn.execute(
        "UPDATE clients SET balance = balance - ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![input.amount, input.client_id],
    )
    .map_err(|e| e.to_string())?;

    // 4. Record balance transaction
    conn.execute(
        "INSERT INTO client_balance_transactions
            (client_id, amount, direction, transaction_type, payment_method, account_id, notes)
         VALUES (?1, ?2, 'out', 'withdraw', ?3, ?4, ?5)",
        rusqlite::params![
            input.client_id,
            input.amount,
            input.payment_method,
            input.account_id,
            input.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    let tx_id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT bt.id, bt.client_id, bt.amount, bt.direction, bt.transaction_type,
                bt.order_id, o.number, bt.payment_method, bt.account_id, bt.notes, bt.created_at
         FROM client_balance_transactions bt
         LEFT JOIN orders o ON o.id = bt.order_id
         WHERE bt.id = ?1",
        rusqlite::params![tx_id],
        |row| {
            Ok(ClientBalanceTransaction {
                id: row.get(0)?,
                client_id: row.get(1)?,
                amount: row.get(2)?,
                direction: row.get(3)?,
                transaction_type: row.get(4)?,
                order_id: row.get(5)?,
                order_number: row.get(6)?,
                payment_method: row.get(7)?,
                account_id: row.get(8)?,
                notes: row.get(9)?,
                created_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pay_order_from_balance(
    db: State<DbState>,
    input: PayFromBalanceInput,
) -> Result<ClientBalanceTransaction, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 {
        return Err("Сумма оплаты должна быть > 0".to_string());
    }

    // Get order info
    let (client_id, prod_status): (i64, String) = conn
        .query_row(
            "SELECT client_id, production_status FROM orders WHERE id = ?1",
            rusqlite::params![input.order_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| "Заказ не найден".to_string())?;

    if prod_status == "cancelled" {
        return Err("Нельзя оплатить отменённый заказ".to_string());
    }

    // Check client balance
    let balance = get_client_balance(&conn, client_id)?;
    if input.amount > balance + 0.01 {
        return Err(format!(
            "Сумма ({}) превышает баланс клиента ({})",
            input.amount, balance
        ));
    }

    // 1. Deduct from client balance
    conn.execute(
        "UPDATE clients SET balance = balance - ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![input.amount, client_id],
    )
    .map_err(|e| e.to_string())?;

    // 2. Update order paid_amount
    conn.execute(
        "UPDATE orders SET paid_amount = paid_amount + ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![input.amount, input.order_id],
    )
    .map_err(|e| e.to_string())?;

    // 3. Recompute payment status
    crate::commands::orders::recompute_payment_status(&conn, input.order_id)?;

    // 4. Record balance transaction
    conn.execute(
        "INSERT INTO client_balance_transactions
            (client_id, amount, direction, transaction_type, order_id, notes)
         VALUES (?1, ?2, 'out', 'order_payment', ?3, ?4)",
        rusqlite::params![
            client_id,
            input.amount,
            input.order_id,
            input.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    let tx_id = conn.last_insert_rowid();

    conn.query_row(
        "SELECT bt.id, bt.client_id, bt.amount, bt.direction, bt.transaction_type,
                bt.order_id, o.number, bt.payment_method, bt.account_id, bt.notes, bt.created_at
         FROM client_balance_transactions bt
         LEFT JOIN orders o ON o.id = bt.order_id
         WHERE bt.id = ?1",
        rusqlite::params![tx_id],
        |row| {
            Ok(ClientBalanceTransaction {
                id: row.get(0)?,
                client_id: row.get(1)?,
                amount: row.get(2)?,
                direction: row.get(3)?,
                transaction_type: row.get(4)?,
                order_id: row.get(5)?,
                order_number: row.get(6)?,
                payment_method: row.get(7)?,
                account_id: row.get(8)?,
                notes: row.get(9)?,
                created_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_client_balance_amount(
    db: State<DbState>,
    client_id: i64,
) -> Result<f64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_client_balance(&conn, client_id)
}

#[tauri::command]
pub fn list_clients_with_balance(
    db: State<DbState>,
) -> Result<Vec<ClientWithBalance>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name, c.phone, c.balance,
                    (SELECT MAX(created_at) FROM client_balance_transactions
                     WHERE client_id = c.id)
             FROM clients c
             WHERE c.balance > 0.01
             ORDER BY c.balance DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ClientWithBalance {
                client_id: row.get(0)?,
                client_name: row.get(1)?,
                phone: row.get(2)?,
                balance: row.get(3)?,
                last_transaction_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn list_client_balance_history(
    db: State<DbState>,
    client_id: i64,
) -> Result<Vec<ClientBalanceTransaction>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT bt.id, bt.client_id, bt.amount, bt.direction, bt.transaction_type,
                    bt.order_id, o.number, bt.payment_method, bt.account_id, bt.notes, bt.created_at
             FROM client_balance_transactions bt
             LEFT JOIN orders o ON o.id = bt.order_id
             WHERE bt.client_id = ?1
             ORDER BY bt.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![client_id], |row| {
            Ok(ClientBalanceTransaction {
                id: row.get(0)?,
                client_id: row.get(1)?,
                amount: row.get(2)?,
                direction: row.get(3)?,
                transaction_type: row.get(4)?,
                order_id: row.get(5)?,
                order_number: row.get(6)?,
                payment_method: row.get(7)?,
                account_id: row.get(8)?,
                notes: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

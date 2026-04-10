use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;

// ── DTOs ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CompanyAccount {
    pub id: i64,
    pub name: String,
    pub account_type: String,
    pub balance: f64,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccountInput {
    pub name: String,
    pub account_type: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccountInput {
    pub id: i64,
    pub name: String,
    pub account_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FinanceTransaction {
    pub id: i64,
    pub transaction_type: String,
    pub amount: f64,
    pub direction: String,
    pub account_id: Option<i64>,
    pub account_name: Option<String>,
    pub counter_account_id: Option<i64>,
    pub linked_transaction_id: Option<i64>,
    pub order_id: Option<i64>,
    pub order_number: Option<String>,
    pub liability_id: Option<i64>,
    pub partner_id: Option<i64>,
    pub partner_name: Option<String>,
    pub finance_category_id: Option<i64>,
    pub category_name: Option<String>,
    pub description: Option<String>,
    pub transaction_date: String,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterOtherIncomeInput {
    pub amount: f64,
    pub account_id: i64,
    pub finance_category_id: Option<i64>,
    pub description: Option<String>,
    pub transaction_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterCompanyExpenseInput {
    pub amount: f64,
    pub account_id: i64,
    pub finance_category_id: Option<i64>,
    pub description: Option<String>,
    pub transaction_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TransferBetweenAccountsInput {
    pub amount: f64,
    pub from_account_id: i64,
    pub to_account_id: i64,
    pub description: Option<String>,
    pub transaction_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LinkTransactionToOrderInput {
    pub transaction_id: i64,
    pub order_id: i64,
}

#[derive(Debug, Deserialize)]
pub struct ListTransactionsFilter {
    pub transaction_type: Option<String>,
    pub account_id: Option<i64>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub order_id: Option<i64>,
}

// ── Liability DTOs ───────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Liability {
    pub id: i64,
    pub liability_type: String,
    pub counterparty_name: String,
    pub description: Option<String>,
    pub original_amount: f64,
    pub paid_amount: f64,
    pub remaining_amount: f64,
    pub status: String,
    pub opened_at: String,
    pub due_date: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct OpenLiabilityInput {
    pub liability_type: String,
    pub counterparty_name: String,
    pub description: Option<String>,
    pub original_amount: f64,
    pub opened_at: Option<String>,
    pub due_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PayLiabilityInput {
    pub liability_id: i64,
    pub amount: f64,
    pub account_id: i64,
    pub description: Option<String>,
    pub transaction_date: Option<String>,
}

// ── Partner settlement DTOs ──────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct PartnerSettlementEntry {
    pub id: i64,
    pub partner_id: i64,
    pub partner_name: String,
    pub entry_type: String,
    pub amount: f64,
    pub finance_transaction_id: Option<i64>,
    pub description: Option<String>,
    pub period: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPartnerContributionInput {
    pub partner_id: i64,
    pub amount: f64,
    pub account_id: i64,
    pub description: Option<String>,
    pub transaction_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPartnerExpenseInput {
    pub partner_id: i64,
    pub amount: f64,
    pub finance_category_id: Option<i64>,
    pub description: Option<String>,
    pub transaction_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ReimbursePartnerInput {
    pub partner_id: i64,
    pub amount: f64,
    pub account_id: i64,
    pub description: Option<String>,
    pub transaction_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPartnerDrawInput {
    pub partner_id: i64,
    pub amount: f64,
    pub account_id: i64,
    pub description: Option<String>,
    pub transaction_date: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterPartnerProfitPayoutInput {
    pub partner_id: i64,
    pub amount: f64,
    pub account_id: i64,
    pub description: Option<String>,
    pub transaction_date: Option<String>,
}

// ── Closing period DTOs ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ClosingPeriod {
    pub id: i64,
    pub period: String,
    pub total_income: f64,
    pub total_expense: f64,
    pub profit: f64,
    pub status: String,
    pub closed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ClosePeriodInput {
    pub period: String,
    pub force: Option<bool>,
}

// ── Derived calculations DTOs ────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct AccountBalance {
    pub id: i64,
    pub name: String,
    pub account_type: String,
    pub balance: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PartnerSummary {
    pub partner_id: i64,
    pub partner_name: String,
    pub contributions: f64,
    pub reimbursements: f64,
    pub profit_accrued: f64,
    pub profit_paid: f64,
    pub draws: f64,
    pub adjustments: f64,
    pub balance: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FinanceSummary {
    pub account_balances: Vec<AccountBalance>,
    pub total_balance: f64,
    pub supplier_debt_outstanding: f64,
    pub client_balance_total: f64,
    pub clients_with_balance_count: i64,
    pub partner_summaries: Vec<PartnerSummary>,
}

// ═══════════════════════════════════════════════════════════════════════
// Company Accounts
// ═══════════════════════════════════════════════════════════════════════

#[tauri::command]
pub fn list_accounts(db: State<DbState>) -> Result<Vec<CompanyAccount>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    list_accounts_impl(&conn)
}

pub(crate) fn list_accounts_impl(conn: &Connection) -> Result<Vec<CompanyAccount>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, name, account_type, balance, is_active, created_at
             FROM company_accounts ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(CompanyAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                balance: row.get(3)?,
                is_active: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn create_account(
    db: State<DbState>,
    input: CreateAccountInput,
) -> Result<CompanyAccount, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.name.trim().is_empty() {
        return Err("Название счёта не может быть пустым".to_string());
    }

    let valid_types = ["cash", "card", "bank"];
    if !valid_types.contains(&input.account_type.as_str()) {
        return Err(format!("Недопустимый тип счёта: {}", input.account_type));
    }

    conn.execute(
        "INSERT INTO company_accounts (name, account_type) VALUES (?1, ?2)",
        rusqlite::params![input.name.trim(), input.account_type],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, account_type, balance, is_active, created_at
         FROM company_accounts WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(CompanyAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                balance: row.get(3)?,
                is_active: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_account(
    db: State<DbState>,
    input: UpdateAccountInput,
) -> Result<CompanyAccount, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.name.trim().is_empty() {
        return Err("Название счёта не может быть пустым".to_string());
    }

    let valid_types = ["cash", "card", "bank"];
    if !valid_types.contains(&input.account_type.as_str()) {
        return Err(format!("Недопустимый тип счёта: {}", input.account_type));
    }

    let affected = conn
        .execute(
            "UPDATE company_accounts SET name = ?1, account_type = ?2 WHERE id = ?3",
            rusqlite::params![input.name.trim(), input.account_type, input.id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Счёт не найден".to_string());
    }

    conn.query_row(
        "SELECT id, name, account_type, balance, is_active, created_at
         FROM company_accounts WHERE id = ?1",
        rusqlite::params![input.id],
        |row| {
            Ok(CompanyAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                balance: row.get(3)?,
                is_active: row.get::<_, i32>(4)? != 0,
                created_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn archive_account(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Проверяем, что баланс нулевой
    let balance: f64 = conn
        .query_row(
            "SELECT balance FROM company_accounts WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| "Счёт не найден".to_string())?;

    if balance.abs() > 0.01 {
        return Err(format!(
            "Нельзя архивировать счёт с ненулевым балансом ({:.2})",
            balance
        ));
    }

    conn.execute(
        "UPDATE company_accounts SET is_active = 0 WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

// ═══════════════════════════════════════════════════════════════════════
// Finance Transactions
// ═══════════════════════════════════════════════════════════════════════

fn validate_account_active(conn: &Connection, account_id: i64) -> Result<(), String> {
    let is_active: i32 = conn
        .query_row(
            "SELECT is_active FROM company_accounts WHERE id = ?1",
            rusqlite::params![account_id],
            |row| row.get(0),
        )
        .map_err(|_| "Счёт не найден".to_string())?;

    if is_active == 0 {
        return Err("Счёт неактивен".to_string());
    }
    Ok(())
}

fn fetch_transaction(conn: &Connection, id: i64) -> Result<FinanceTransaction, String> {
    conn.query_row(
        "SELECT ft.id, ft.transaction_type, ft.amount, ft.direction,
                ft.account_id, ca.name,
                ft.counter_account_id, ft.linked_transaction_id,
                ft.order_id, o.number,
                ft.liability_id, ft.partner_id, p.name,
                ft.finance_category_id, fc.name,
                ft.description, ft.transaction_date, ft.created_at
         FROM finance_transactions ft
         LEFT JOIN company_accounts ca ON ca.id = ft.account_id
         LEFT JOIN orders o ON o.id = ft.order_id
         LEFT JOIN partners p ON p.id = ft.partner_id
         LEFT JOIN finance_categories fc ON fc.id = ft.finance_category_id
         WHERE ft.id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(FinanceTransaction {
                id: row.get(0)?,
                transaction_type: row.get(1)?,
                amount: row.get(2)?,
                direction: row.get(3)?,
                account_id: row.get(4)?,
                account_name: row.get(5)?,
                counter_account_id: row.get(6)?,
                linked_transaction_id: row.get(7)?,
                order_id: row.get(8)?,
                order_number: row.get(9)?,
                liability_id: row.get(10)?,
                partner_id: row.get(11)?,
                partner_name: row.get(12)?,
                finance_category_id: row.get(13)?,
                category_name: row.get(14)?,
                description: row.get(15)?,
                transaction_date: row.get(16)?,
                created_at: row.get(17)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn register_other_income(
    db: State<DbState>,
    input: RegisterOtherIncomeInput,
) -> Result<FinanceTransaction, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 {
        return Err("Сумма должна быть > 0".to_string());
    }
    validate_account_active(&conn, input.account_id)?;

    let date = input.transaction_date.as_deref().filter(|d| !d.is_empty());
    let sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, finance_category_id, description, transaction_date)
         VALUES ('other_income_in', ?1, 'in', ?2, ?3, ?4, {})",
        if date.is_some() { "?5" } else { "date('now')" }
    );

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.account_id),
        Box::new(input.finance_category_id),
        Box::new(input.description),
    ];
    if let Some(d) = date {
        params.push(Box::new(d.to_string()));
    }

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    conn.execute(
        "UPDATE company_accounts SET balance = balance + ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    fetch_transaction(&conn, id)
}

#[tauri::command]
pub fn register_company_expense(
    db: State<DbState>,
    input: RegisterCompanyExpenseInput,
) -> Result<FinanceTransaction, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 {
        return Err("Сумма должна быть > 0".to_string());
    }
    validate_account_active(&conn, input.account_id)?;

    let date = input.transaction_date.as_deref().filter(|d| !d.is_empty());
    let sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, finance_category_id, description, transaction_date)
         VALUES ('company_expense_out', ?1, 'out', ?2, ?3, ?4, {})",
        if date.is_some() { "?5" } else { "date('now')" }
    );

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.account_id),
        Box::new(input.finance_category_id),
        Box::new(input.description),
    ];
    if let Some(d) = date {
        params.push(Box::new(d.to_string()));
    }

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();

    conn.execute(
        "UPDATE company_accounts SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    fetch_transaction(&conn, id)
}

#[tauri::command]
pub fn transfer_between_accounts(
    db: State<DbState>,
    input: TransferBetweenAccountsInput,
) -> Result<FinanceTransaction, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 {
        return Err("Сумма должна быть > 0".to_string());
    }
    if input.from_account_id == input.to_account_id {
        return Err("Счёт-источник и счёт-назначение не могут совпадать".to_string());
    }
    validate_account_active(&conn, input.from_account_id)?;
    validate_account_active(&conn, input.to_account_id)?;

    let date = input.transaction_date.as_deref().filter(|d| !d.is_empty());
    let date_val = date.unwrap_or("");

    // OUT record
    let out_sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, counter_account_id, description, transaction_date)
         VALUES ('transfer_between_accounts', ?1, 'out', ?2, ?3, ?4, {})",
        if date.is_some() { "?5" } else { "date('now')" }
    );

    let mut out_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.from_account_id),
        Box::new(input.to_account_id),
        Box::new(input.description.clone()),
    ];
    if date.is_some() {
        out_params.push(Box::new(date_val.to_string()));
    }

    let out_refs: Vec<&dyn rusqlite::types::ToSql> = out_params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&out_sql, out_refs.as_slice())
        .map_err(|e| e.to_string())?;
    let out_id = conn.last_insert_rowid();

    // IN record
    let in_sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, counter_account_id, linked_transaction_id, description, transaction_date)
         VALUES ('transfer_between_accounts', ?1, 'in', ?2, ?3, ?4, ?5, {})",
        if date.is_some() { "?6" } else { "date('now')" }
    );

    let mut in_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.to_account_id),
        Box::new(input.from_account_id),
        Box::new(out_id),
        Box::new(input.description),
    ];
    if date.is_some() {
        in_params.push(Box::new(date_val.to_string()));
    }

    let in_refs: Vec<&dyn rusqlite::types::ToSql> = in_params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&in_sql, in_refs.as_slice())
        .map_err(|e| e.to_string())?;
    let in_id = conn.last_insert_rowid();

    // Link out -> in
    conn.execute(
        "UPDATE finance_transactions SET linked_transaction_id = ?1 WHERE id = ?2",
        rusqlite::params![in_id, out_id],
    )
    .map_err(|e| e.to_string())?;

    // Update balances
    conn.execute(
        "UPDATE company_accounts SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.from_account_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE company_accounts SET balance = balance + ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.to_account_id],
    )
    .map_err(|e| e.to_string())?;

    fetch_transaction(&conn, out_id)
}

#[tauri::command]
pub fn link_transaction_to_order(
    db: State<DbState>,
    input: LinkTransactionToOrderInput,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Проверяем, что транзакция и заказ существуют
    let _: i64 = conn
        .query_row(
            "SELECT id FROM finance_transactions WHERE id = ?1",
            rusqlite::params![input.transaction_id],
            |row| row.get(0),
        )
        .map_err(|_| "Транзакция не найдена".to_string())?;

    let _: i64 = conn
        .query_row(
            "SELECT id FROM orders WHERE id = ?1",
            rusqlite::params![input.order_id],
            |row| row.get(0),
        )
        .map_err(|_| "Заказ не найден".to_string())?;

    conn.execute(
        "UPDATE finance_transactions SET order_id = ?1 WHERE id = ?2",
        rusqlite::params![input.order_id, input.transaction_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn list_transactions(
    db: State<DbState>,
    filter: ListTransactionsFilter,
) -> Result<Vec<FinanceTransaction>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    list_transactions_impl(&conn, &filter)
}

pub(crate) fn list_transactions_impl(
    conn: &Connection,
    filter: &ListTransactionsFilter,
) -> Result<Vec<FinanceTransaction>, String> {
    let mut conditions = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref tt) = filter.transaction_type {
        conditions.push(format!("ft.transaction_type = ?{idx}"));
        params.push(Box::new(tt.clone()));
        idx += 1;
    }
    if let Some(aid) = filter.account_id {
        conditions.push(format!("ft.account_id = ?{idx}"));
        params.push(Box::new(aid));
        idx += 1;
    }
    if let Some(ref df) = filter.date_from {
        conditions.push(format!("ft.transaction_date >= ?{idx}"));
        params.push(Box::new(df.clone()));
        idx += 1;
    }
    if let Some(ref dt) = filter.date_to {
        conditions.push(format!("ft.transaction_date <= ?{idx}"));
        params.push(Box::new(dt.clone()));
        idx += 1;
    }
    if let Some(oid) = filter.order_id {
        conditions.push(format!("ft.order_id = ?{idx}"));
        params.push(Box::new(oid));
        // idx += 1;
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT ft.id, ft.transaction_type, ft.amount, ft.direction,
                ft.account_id, ca.name,
                ft.counter_account_id, ft.linked_transaction_id,
                ft.order_id, o.number,
                ft.liability_id, ft.partner_id, p.name,
                ft.finance_category_id, fc.name,
                ft.description, ft.transaction_date, ft.created_at
         FROM finance_transactions ft
         LEFT JOIN company_accounts ca ON ca.id = ft.account_id
         LEFT JOIN orders o ON o.id = ft.order_id
         LEFT JOIN partners p ON p.id = ft.partner_id
         LEFT JOIN finance_categories fc ON fc.id = ft.finance_category_id
         {where_clause}
         ORDER BY ft.transaction_date DESC, ft.id DESC"
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(FinanceTransaction {
                id: row.get(0)?,
                transaction_type: row.get(1)?,
                amount: row.get(2)?,
                direction: row.get(3)?,
                account_id: row.get(4)?,
                account_name: row.get(5)?,
                counter_account_id: row.get(6)?,
                linked_transaction_id: row.get(7)?,
                order_id: row.get(8)?,
                order_number: row.get(9)?,
                liability_id: row.get(10)?,
                partner_id: row.get(11)?,
                partner_name: row.get(12)?,
                finance_category_id: row.get(13)?,
                category_name: row.get(14)?,
                description: row.get(15)?,
                transaction_date: row.get(16)?,
                created_at: row.get(17)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

// ═══════════════════════════════════════════════════════════════════════
// Liabilities
// ═══════════════════════════════════════════════════════════════════════

#[tauri::command]
pub fn open_liability(
    db: State<DbState>,
    input: OpenLiabilityInput,
) -> Result<Liability, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    open_liability_impl(&conn, &input)
}

pub(crate) fn open_liability_impl(
    conn: &Connection,
    input: &OpenLiabilityInput,
) -> Result<Liability, String> {
    if input.original_amount <= 0.0 {
        return Err("Сумма долга должна быть > 0".to_string());
    }
    if input.counterparty_name.trim().is_empty() {
        return Err("Имя контрагента не может быть пустым".to_string());
    }
    let valid_types = ["supplier_debt", "other"];
    if !valid_types.contains(&input.liability_type.as_str()) {
        return Err(format!(
            "Недопустимый тип обязательства: {}",
            input.liability_type
        ));
    }

    let date = input.opened_at.as_deref().filter(|d| !d.is_empty());
    let sql = format!(
        "INSERT INTO liabilities (liability_type, counterparty_name, description, original_amount, opened_at, due_date)
         VALUES (?1, ?2, ?3, ?4, {}, ?5)",
        if date.is_some() { "?6" } else { "date('now')" }
    );

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.liability_type.clone()),
        Box::new(input.counterparty_name.trim().to_string()),
        Box::new(input.description.clone()),
        Box::new(input.original_amount),
        Box::new(input.due_date.clone()),
    ];
    if let Some(d) = date {
        params.push(Box::new(d.to_string()));
    }

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;
    let liability_id = conn.last_insert_rowid();

    // Регистрируем транзакцию supplier_debt_opened (без движения по счетам)
    let debt_date = date.unwrap_or("");
    let ft_sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, liability_id, description, transaction_date)
         VALUES ('supplier_debt_opened', ?1, 'none', ?2, ?3, {})",
        if date.is_some() { "?4" } else { "date('now')" }
    );

    let desc = format!(
        "Открытие долга: {}",
        input.counterparty_name.trim()
    );
    let mut ft_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.original_amount),
        Box::new(liability_id),
        Box::new(desc),
    ];
    if date.is_some() {
        ft_params.push(Box::new(debt_date.to_string()));
    }

    let ft_refs: Vec<&dyn rusqlite::types::ToSql> = ft_params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&ft_sql, ft_refs.as_slice())
        .map_err(|e| e.to_string())?;

    fetch_liability(conn, liability_id)
}

fn fetch_liability(conn: &Connection, id: i64) -> Result<Liability, String> {
    conn.query_row(
        "SELECT id, liability_type, counterparty_name, description,
                original_amount, paid_amount, status, opened_at, due_date, created_at
         FROM liabilities WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            let original: f64 = row.get(4)?;
            let paid: f64 = row.get(5)?;
            Ok(Liability {
                id: row.get(0)?,
                liability_type: row.get(1)?,
                counterparty_name: row.get(2)?,
                description: row.get(3)?,
                original_amount: original,
                paid_amount: paid,
                remaining_amount: original - paid,
                status: row.get(6)?,
                opened_at: row.get(7)?,
                due_date: row.get(8)?,
                created_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pay_liability(
    db: State<DbState>,
    input: PayLiabilityInput,
) -> Result<Liability, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    pay_liability_impl(&conn, &input)
}

pub(crate) fn pay_liability_impl(
    conn: &Connection,
    input: &PayLiabilityInput,
) -> Result<Liability, String> {
    if input.amount <= 0.0 {
        return Err("Сумма оплаты должна быть > 0".to_string());
    }
    validate_account_active(conn, input.account_id)?;

    let (original, paid, status, name): (f64, f64, String, String) = conn
        .query_row(
            "SELECT original_amount, paid_amount, status, counterparty_name FROM liabilities WHERE id = ?1",
            rusqlite::params![input.liability_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Обязательство не найдено".to_string())?;

    if status != "open" {
        return Err(format!("Обязательство уже {status}"));
    }

    let remaining = original - paid;
    if input.amount > remaining + 0.01 {
        return Err(format!(
            "Сумма оплаты ({:.2}) превышает остаток долга ({:.2})",
            input.amount, remaining
        ));
    }

    let date = input.transaction_date.as_deref().filter(|d| !d.is_empty());
    let desc = input
        .description
        .clone()
        .unwrap_or_else(|| format!("Оплата долга: {name}"));

    let ft_sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, liability_id, description, transaction_date)
         VALUES ('supplier_debt_paid', ?1, 'out', ?2, ?3, ?4, {})",
        if date.is_some() { "?5" } else { "date('now')" }
    );

    let mut ft_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.account_id),
        Box::new(input.liability_id),
        Box::new(desc),
    ];
    if let Some(d) = date {
        ft_params.push(Box::new(d.to_string()));
    }

    let ft_refs: Vec<&dyn rusqlite::types::ToSql> = ft_params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&ft_sql, ft_refs.as_slice())
        .map_err(|e| e.to_string())?;

    // Обновляем баланс счёта
    conn.execute(
        "UPDATE company_accounts SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    // Обновляем paid_amount и статус
    let new_paid = paid + input.amount;
    let new_status = if (new_paid - original).abs() < 0.01 {
        "paid"
    } else {
        "open"
    };

    conn.execute(
        "UPDATE liabilities SET paid_amount = ?1, status = ?2, updated_at = datetime('now') WHERE id = ?3",
        rusqlite::params![new_paid, new_status, input.liability_id],
    )
    .map_err(|e| e.to_string())?;

    fetch_liability(conn, input.liability_id)
}

#[tauri::command]
pub fn list_liabilities(
    db: State<DbState>,
    status: Option<String>,
) -> Result<Vec<Liability>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match status {
        Some(ref s) => (
            "SELECT id, liability_type, counterparty_name, description,
                    original_amount, paid_amount, status, opened_at, due_date, created_at
             FROM liabilities WHERE status = ?1 ORDER BY opened_at DESC"
                .to_string(),
            vec![Box::new(s.clone())],
        ),
        None => (
            "SELECT id, liability_type, counterparty_name, description,
                    original_amount, paid_amount, status, opened_at, due_date, created_at
             FROM liabilities ORDER BY opened_at DESC"
                .to_string(),
            vec![],
        ),
    };

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            let original: f64 = row.get(4)?;
            let paid: f64 = row.get(5)?;
            Ok(Liability {
                id: row.get(0)?,
                liability_type: row.get(1)?,
                counterparty_name: row.get(2)?,
                description: row.get(3)?,
                original_amount: original,
                paid_amount: paid,
                remaining_amount: original - paid,
                status: row.get(6)?,
                opened_at: row.get(7)?,
                due_date: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

// ═══════════════════════════════════════════════════════════════════════
// Partner Settlements
// ═══════════════════════════════════════════════════════════════════════

fn validate_partner(conn: &Connection, partner_id: i64) -> Result<String, String> {
    conn.query_row(
        "SELECT name FROM partners WHERE id = ?1",
        rusqlite::params![partner_id],
        |row| row.get(0),
    )
    .map_err(|_| "Партнёр не найден".to_string())
}

fn fetch_settlement_entry(conn: &Connection, id: i64) -> Result<PartnerSettlementEntry, String> {
    conn.query_row(
        "SELECT pse.id, pse.partner_id, p.name, pse.entry_type, pse.amount,
                pse.finance_transaction_id, pse.description, pse.period, pse.created_at
         FROM partner_settlement_entries pse
         JOIN partners p ON p.id = pse.partner_id
         WHERE pse.id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(PartnerSettlementEntry {
                id: row.get(0)?,
                partner_id: row.get(1)?,
                partner_name: row.get(2)?,
                entry_type: row.get(3)?,
                amount: row.get(4)?,
                finance_transaction_id: row.get(5)?,
                description: row.get(6)?,
                period: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn register_partner_contribution(
    db: State<DbState>,
    input: RegisterPartnerContributionInput,
) -> Result<PartnerSettlementEntry, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    register_partner_contribution_impl(&conn, &input)
}

pub(crate) fn register_partner_contribution_impl(
    conn: &Connection,
    input: &RegisterPartnerContributionInput,
) -> Result<PartnerSettlementEntry, String> {
    if input.amount <= 0.0 {
        return Err("Сумма должна быть > 0".to_string());
    }
    let partner_name = validate_partner(conn, input.partner_id)?;
    validate_account_active(conn, input.account_id)?;

    let date = input.transaction_date.as_deref().filter(|d| !d.is_empty());
    let desc = input
        .description
        .clone()
        .unwrap_or_else(|| format!("Вклад партнёра: {partner_name}"));

    // Finance transaction (in на счёт)
    let ft_sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
         VALUES ('partner_paid_company_expense', ?1, 'none', ?2, ?3, ?4, {})",
        if date.is_some() { "?5" } else { "date('now')" }
    );

    let mut ft_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.account_id),
        Box::new(input.partner_id),
        Box::new(desc.clone()),
    ];
    if let Some(d) = date {
        ft_params.push(Box::new(d.to_string()));
    }

    let ft_refs: Vec<&dyn rusqlite::types::ToSql> = ft_params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&ft_sql, ft_refs.as_slice())
        .map_err(|e| e.to_string())?;
    let ft_id = conn.last_insert_rowid();

    // Деньги попадают на счёт компании
    conn.execute(
        "UPDATE company_accounts SET balance = balance + ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    // Partner settlement entry
    conn.execute(
        "INSERT INTO partner_settlement_entries
            (partner_id, entry_type, amount, finance_transaction_id, description)
         VALUES (?1, 'contribution', ?2, ?3, ?4)",
        rusqlite::params![input.partner_id, input.amount, ft_id, desc],
    )
    .map_err(|e| e.to_string())?;

    let pse_id = conn.last_insert_rowid();
    fetch_settlement_entry(conn, pse_id)
}

#[tauri::command]
pub fn register_partner_expense(
    db: State<DbState>,
    input: RegisterPartnerExpenseInput,
) -> Result<PartnerSettlementEntry, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.amount <= 0.0 {
        return Err("Сумма должна быть > 0".to_string());
    }
    let partner_name = validate_partner(&conn, input.partner_id)?;

    let date = input.transaction_date.as_deref().filter(|d| !d.is_empty());
    let desc = input
        .description
        .clone()
        .unwrap_or_else(|| format!("Партнёр {partner_name} оплатил расход из личных средств"));

    // Finance transaction (без движения по счетам компании)
    let ft_sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, partner_id, finance_category_id, description, transaction_date)
         VALUES ('partner_paid_company_expense', ?1, 'none', ?2, ?3, ?4, {})",
        if date.is_some() { "?5" } else { "date('now')" }
    );

    let mut ft_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.partner_id),
        Box::new(input.finance_category_id),
        Box::new(desc.clone()),
    ];
    if let Some(d) = date {
        ft_params.push(Box::new(d.to_string()));
    }

    let ft_refs: Vec<&dyn rusqlite::types::ToSql> = ft_params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&ft_sql, ft_refs.as_slice())
        .map_err(|e| e.to_string())?;
    let ft_id = conn.last_insert_rowid();

    // Partner settlement: contribution (партнёр вложил деньги)
    conn.execute(
        "INSERT INTO partner_settlement_entries
            (partner_id, entry_type, amount, finance_transaction_id, description)
         VALUES (?1, 'contribution', ?2, ?3, ?4)",
        rusqlite::params![input.partner_id, input.amount, ft_id, desc],
    )
    .map_err(|e| e.to_string())?;

    let pse_id = conn.last_insert_rowid();
    fetch_settlement_entry(&conn, pse_id)
}

#[tauri::command]
pub fn reimburse_partner(
    db: State<DbState>,
    input: ReimbursePartnerInput,
) -> Result<PartnerSettlementEntry, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    reimburse_partner_impl(&conn, &input)
}

pub(crate) fn reimburse_partner_impl(
    conn: &Connection,
    input: &ReimbursePartnerInput,
) -> Result<PartnerSettlementEntry, String> {
    if input.amount <= 0.0 {
        return Err("Сумма должна быть > 0".to_string());
    }
    let partner_name = validate_partner(conn, input.partner_id)?;
    validate_account_active(conn, input.account_id)?;

    let date = input.transaction_date.as_deref().filter(|d| !d.is_empty());
    let desc = input
        .description
        .clone()
        .unwrap_or_else(|| format!("Возмещение партнёру: {partner_name}"));

    let ft_sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
         VALUES ('company_reimbursed_partner', ?1, 'out', ?2, ?3, ?4, {})",
        if date.is_some() { "?5" } else { "date('now')" }
    );

    let mut ft_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.account_id),
        Box::new(input.partner_id),
        Box::new(desc.clone()),
    ];
    if let Some(d) = date {
        ft_params.push(Box::new(d.to_string()));
    }

    let ft_refs: Vec<&dyn rusqlite::types::ToSql> = ft_params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&ft_sql, ft_refs.as_slice())
        .map_err(|e| e.to_string())?;
    let ft_id = conn.last_insert_rowid();

    conn.execute(
        "UPDATE company_accounts SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO partner_settlement_entries
            (partner_id, entry_type, amount, finance_transaction_id, description)
         VALUES (?1, 'reimbursement', ?2, ?3, ?4)",
        rusqlite::params![input.partner_id, input.amount, ft_id, desc],
    )
    .map_err(|e| e.to_string())?;

    let pse_id = conn.last_insert_rowid();
    fetch_settlement_entry(conn, pse_id)
}

#[tauri::command]
pub fn register_partner_draw(
    db: State<DbState>,
    input: RegisterPartnerDrawInput,
) -> Result<PartnerSettlementEntry, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    register_partner_draw_impl(&conn, &input)
}

pub(crate) fn register_partner_draw_impl(
    conn: &Connection,
    input: &RegisterPartnerDrawInput,
) -> Result<PartnerSettlementEntry, String> {
    if input.amount <= 0.0 {
        return Err("Сумма должна быть > 0".to_string());
    }
    let partner_name = validate_partner(conn, input.partner_id)?;
    validate_account_active(conn, input.account_id)?;

    let date = input.transaction_date.as_deref().filter(|d| !d.is_empty());
    let desc = input
        .description
        .clone()
        .unwrap_or_else(|| format!("Draw партнёра: {partner_name}"));

    let ft_sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
         VALUES ('partner_draw', ?1, 'out', ?2, ?3, ?4, {})",
        if date.is_some() { "?5" } else { "date('now')" }
    );

    let mut ft_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.account_id),
        Box::new(input.partner_id),
        Box::new(desc.clone()),
    ];
    if let Some(d) = date {
        ft_params.push(Box::new(d.to_string()));
    }

    let ft_refs: Vec<&dyn rusqlite::types::ToSql> = ft_params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&ft_sql, ft_refs.as_slice())
        .map_err(|e| e.to_string())?;
    let ft_id = conn.last_insert_rowid();

    conn.execute(
        "UPDATE company_accounts SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO partner_settlement_entries
            (partner_id, entry_type, amount, finance_transaction_id, description)
         VALUES (?1, 'draw', ?2, ?3, ?4)",
        rusqlite::params![input.partner_id, input.amount, ft_id, desc],
    )
    .map_err(|e| e.to_string())?;

    let pse_id = conn.last_insert_rowid();
    fetch_settlement_entry(conn, pse_id)
}

#[tauri::command]
pub fn register_partner_profit_payout(
    db: State<DbState>,
    input: RegisterPartnerProfitPayoutInput,
) -> Result<PartnerSettlementEntry, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    register_partner_profit_payout_impl(&conn, &input)
}

pub(crate) fn register_partner_profit_payout_impl(
    conn: &Connection,
    input: &RegisterPartnerProfitPayoutInput,
) -> Result<PartnerSettlementEntry, String> {
    if input.amount <= 0.0 {
        return Err("Сумма должна быть > 0".to_string());
    }
    let partner_name = validate_partner(conn, input.partner_id)?;
    validate_account_active(conn, input.account_id)?;

    let date = input.transaction_date.as_deref().filter(|d| !d.is_empty());
    let desc = input
        .description
        .clone()
        .unwrap_or_else(|| format!("Выплата прибыли: {partner_name}"));

    let ft_sql = format!(
        "INSERT INTO finance_transactions
            (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
         VALUES ('partner_profit_payout', ?1, 'out', ?2, ?3, ?4, {})",
        if date.is_some() { "?5" } else { "date('now')" }
    );

    let mut ft_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(input.amount),
        Box::new(input.account_id),
        Box::new(input.partner_id),
        Box::new(desc.clone()),
    ];
    if let Some(d) = date {
        ft_params.push(Box::new(d.to_string()));
    }

    let ft_refs: Vec<&dyn rusqlite::types::ToSql> = ft_params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&ft_sql, ft_refs.as_slice())
        .map_err(|e| e.to_string())?;
    let ft_id = conn.last_insert_rowid();

    conn.execute(
        "UPDATE company_accounts SET balance = balance - ?1 WHERE id = ?2",
        rusqlite::params![input.amount, input.account_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO partner_settlement_entries
            (partner_id, entry_type, amount, finance_transaction_id, description)
         VALUES (?1, 'profit_payout', ?2, ?3, ?4)",
        rusqlite::params![input.partner_id, input.amount, ft_id, desc],
    )
    .map_err(|e| e.to_string())?;

    let pse_id = conn.last_insert_rowid();
    fetch_settlement_entry(conn, pse_id)
}

#[tauri::command]
pub fn list_partner_settlements(
    db: State<DbState>,
    partner_id: Option<i64>,
) -> Result<Vec<PartnerSettlementEntry>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match partner_id {
        Some(pid) => (
            "SELECT pse.id, pse.partner_id, p.name, pse.entry_type, pse.amount,
                    pse.finance_transaction_id, pse.description, pse.period, pse.created_at
             FROM partner_settlement_entries pse
             JOIN partners p ON p.id = pse.partner_id
             WHERE pse.partner_id = ?1
             ORDER BY pse.created_at DESC"
                .to_string(),
            vec![Box::new(pid)],
        ),
        None => (
            "SELECT pse.id, pse.partner_id, p.name, pse.entry_type, pse.amount,
                    pse.finance_transaction_id, pse.description, pse.period, pse.created_at
             FROM partner_settlement_entries pse
             JOIN partners p ON p.id = pse.partner_id
             ORDER BY pse.created_at DESC"
                .to_string(),
            vec![],
        ),
    };

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(PartnerSettlementEntry {
                id: row.get(0)?,
                partner_id: row.get(1)?,
                partner_name: row.get(2)?,
                entry_type: row.get(3)?,
                amount: row.get(4)?,
                finance_transaction_id: row.get(5)?,
                description: row.get(6)?,
                period: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

// ═══════════════════════════════════════════════════════════════════════
// Closing Period
// ═══════════════════════════════════════════════════════════════════════

#[tauri::command]
pub fn close_period(
    db: State<DbState>,
    input: ClosePeriodInput,
) -> Result<ClosingPeriod, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    close_period_impl(&conn, &input)
}

pub(crate) fn close_period_impl(
    conn: &Connection,
    input: &ClosePeriodInput,
) -> Result<ClosingPeriod, String> {
    // Валидация формата периода YYYY-MM
    if !is_valid_period(&input.period) {
        return Err(format!("Неверный формат периода: {}. Ожидается YYYY-MM", input.period));
    }

    // Проверка на дубликат
    let existing: Option<String> = conn
        .query_row(
            "SELECT status FROM closing_periods WHERE period = ?1",
            rusqlite::params![input.period],
            |row| row.get(0),
        )
        .ok();

    if let Some(status) = existing {
        if status == "closed" && !input.force.unwrap_or(false) {
            return Err(format!(
                "Период {} уже закрыт. Передайте force=true для повторного закрытия",
                input.period
            ));
        }
        // Удаляем старые accrual записи для повторного расчёта
        conn.execute(
            "DELETE FROM partner_settlement_entries WHERE period = ?1 AND entry_type = 'profit_accrual'",
            rusqlite::params![input.period],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "DELETE FROM closing_periods WHERE period = ?1",
            rusqlite::params![input.period],
        )
        .map_err(|e| e.to_string())?;
    }

    // Рассчитываем income/expense за период
    let period_start = format!("{}-01", input.period);
    let period_end = next_month_start(&input.period)?;

    let total_income: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM finance_transactions
             WHERE transaction_type IN ('order_payment_in', 'other_income_in')
             AND transaction_date >= ?1 AND transaction_date < ?2",
            rusqlite::params![period_start, period_end],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let total_expense: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM finance_transactions
             WHERE transaction_type IN ('company_expense_out', 'supplier_debt_paid', 'order_refund_out')
             AND transaction_date >= ?1 AND transaction_date < ?2",
            rusqlite::params![period_start, period_end],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let profit = total_income - total_expense;

    // Создаём closing_period
    conn.execute(
        "INSERT INTO closing_periods (period, total_income, total_expense, profit, status, closed_at)
         VALUES (?1, ?2, ?3, ?4, 'closed', datetime('now'))",
        rusqlite::params![input.period, total_income, total_expense, profit],
    )
    .map_err(|e| e.to_string())?;
    let cp_id = conn.last_insert_rowid();

    // Начисляем прибыль партнёрам 50/50
    let mut stmt = conn
        .prepare("SELECT id, name, profit_share FROM partners")
        .map_err(|e| e.to_string())?;
    let partners: Vec<(i64, String, f64)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for (pid, pname, share) in &partners {
        let accrual = profit * share;
        conn.execute(
            "INSERT INTO partner_settlement_entries
                (partner_id, entry_type, amount, description, period)
             VALUES (?1, 'profit_accrual', ?2, ?3, ?4)",
            rusqlite::params![
                pid,
                accrual,
                format!("Начисление прибыли за {}: {pname}", input.period),
                input.period,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.query_row(
        "SELECT id, period, total_income, total_expense, profit, status, closed_at, created_at
         FROM closing_periods WHERE id = ?1",
        rusqlite::params![cp_id],
        |row| {
            Ok(ClosingPeriod {
                id: row.get(0)?,
                period: row.get(1)?,
                total_income: row.get(2)?,
                total_expense: row.get(3)?,
                profit: row.get(4)?,
                status: row.get(5)?,
                closed_at: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_closing_periods(db: State<DbState>) -> Result<Vec<ClosingPeriod>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, period, total_income, total_expense, profit, status, closed_at, created_at
             FROM closing_periods ORDER BY period DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(ClosingPeriod {
                id: row.get(0)?,
                period: row.get(1)?,
                total_income: row.get(2)?,
                total_expense: row.get(3)?,
                profit: row.get(4)?,
                status: row.get(5)?,
                closed_at: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

// ═══════════════════════════════════════════════════════════════════════
// Derived Calculations / Summary
// ═══════════════════════════════════════════════════════════════════════

#[tauri::command]
pub fn get_finance_summary(db: State<DbState>) -> Result<FinanceSummary, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    get_finance_summary_impl(&conn)
}

pub(crate) fn get_finance_summary_impl(conn: &Connection) -> Result<FinanceSummary, String> {
    // Account balances
    let mut stmt = conn
        .prepare(
            "SELECT id, name, account_type, balance FROM company_accounts WHERE is_active = 1 ORDER BY name",
        )
        .map_err(|e| e.to_string())?;

    let account_balances: Vec<AccountBalance> = stmt
        .query_map([], |row| {
            Ok(AccountBalance {
                id: row.get(0)?,
                name: row.get(1)?,
                account_type: row.get(2)?,
                balance: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let total_balance: f64 = account_balances.iter().map(|a| a.balance).sum();

    // Outstanding supplier debt
    let supplier_debt_outstanding: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(original_amount - paid_amount), 0)
             FROM liabilities WHERE status = 'open'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Client balance obligations (money clients prepaid, company owes service)
    let client_balance_total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(balance), 0) FROM clients WHERE balance > 0.01",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let clients_with_balance_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM clients WHERE balance > 0.01",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    // Partner summaries
    let partner_summaries = compute_partner_summaries(conn)?;

    Ok(FinanceSummary {
        account_balances,
        total_balance,
        supplier_debt_outstanding,
        client_balance_total,
        clients_with_balance_count,
        partner_summaries,
    })
}

pub(crate) fn compute_partner_summaries(conn: &Connection) -> Result<Vec<PartnerSummary>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name FROM partners ORDER BY id")
        .map_err(|e| e.to_string())?;

    let partners: Vec<(i64, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut summaries = Vec::new();

    for (pid, pname) in partners {
        let sum_by_type = |entry_type: &str| -> Result<f64, String> {
            conn.query_row(
                "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries
                 WHERE partner_id = ?1 AND entry_type = ?2",
                rusqlite::params![pid, entry_type],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())
        };

        let contributions = sum_by_type("contribution")?;
        let reimbursements = sum_by_type("reimbursement")?;
        let profit_accrued = sum_by_type("profit_accrual")?;
        let profit_paid = sum_by_type("profit_payout")?;
        let draws = sum_by_type("draw")?;
        let adjustments = sum_by_type("adjustment")?;

        // balance = contributions + profit_accruals − profit_payouts − draws − reimbursements ± adjustments
        let balance =
            contributions + profit_accrued - profit_paid - draws - reimbursements + adjustments;

        summaries.push(PartnerSummary {
            partner_id: pid,
            partner_name: pname,
            contributions,
            reimbursements,
            profit_accrued,
            profit_paid,
            draws,
            adjustments,
            balance,
        });
    }

    Ok(summaries)
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

fn is_valid_period(period: &str) -> bool {
    if period.len() != 7 {
        return false;
    }
    let parts: Vec<&str> = period.split('-').collect();
    if parts.len() != 2 {
        return false;
    }
    let year: Option<i32> = parts[0].parse().ok();
    let month: Option<i32> = parts[1].parse().ok();
    matches!((year, month), (Some(y), Some(m)) if y >= 2020 && y <= 2100 && m >= 1 && m <= 12)
}

fn next_month_start(period: &str) -> Result<String, String> {
    let parts: Vec<&str> = period.split('-').collect();
    let year: i32 = parts[0].parse().map_err(|_| "Неверный год".to_string())?;
    let month: i32 = parts[1].parse().map_err(|_| "Неверный месяц".to_string())?;

    let (ny, nm) = if month == 12 {
        (year + 1, 1)
    } else {
        (year, month + 1)
    };

    Ok(format!("{:04}-{:02}-01", ny, nm))
}

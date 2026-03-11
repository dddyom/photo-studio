//! Integration tests for finance application layer.
//! Uses in-memory SQLite database with all migrations and seeds applied.

use rusqlite::Connection;

/// Set up an in-memory DB with all migrations and seed data.
fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();

    // v1: Foundation
    conn.execute_batch(
        "CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE partners (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            profit_share REAL NOT NULL DEFAULT 0.5, created_at TEXT NOT NULL DEFAULT (datetime('now')));
         CREATE TABLE company_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            account_type TEXT NOT NULL CHECK (account_type IN ('cash','card','bank')),
            balance REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')));",
    ).unwrap();

    // v2: Catalogs (minimal)
    conn.execute_batch(
        "CREATE TABLE book_formats (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0);
         CREATE TABLE print_formats (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0);
         CREATE TABLE materials (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            category TEXT NOT NULL CHECK (category IN ('block','print','finishing')),
            is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0);
         CREATE TABLE cover_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0);
         CREATE TABLE cover_materials (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0);
         CREATE TABLE lamination_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0);
         CREATE TABLE extra_option_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
            default_price REAL, is_active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0);
         CREATE TABLE finance_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            category_type TEXT NOT NULL CHECK (category_type IN ('income','expense')),
            is_system INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0);",
    ).unwrap();

    // v3: Pricing
    conn.execute_batch(
        "CREATE TABLE pricing_programs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
         CREATE TABLE pricing_rules (id INTEGER PRIMARY KEY AUTOINCREMENT,
            pricing_program_id INTEGER NOT NULL REFERENCES pricing_programs(id),
            item_kind TEXT NOT NULL CHECK (item_kind IN ('book','print','service','extra')),
            match_params TEXT NOT NULL DEFAULT '{}', price_formula TEXT NOT NULL DEFAULT '{}',
            is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));",
    ).unwrap();

    // v4: Clients
    conn.execute_batch(
        "CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            phone TEXT, email TEXT,
            default_pricing_program_id INTEGER REFERENCES pricing_programs(id),
            notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
    ).unwrap();

    // v5: Orders
    conn.execute_batch(
        "CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT,
            number TEXT NOT NULL UNIQUE,
            client_id INTEGER NOT NULL REFERENCES clients(id),
            pricing_program_id INTEGER REFERENCES pricing_programs(id),
            production_status TEXT NOT NULL DEFAULT 'draft'
                CHECK (production_status IN ('draft','confirmed','in_work','ready','closed','cancelled')),
            payment_status TEXT NOT NULL DEFAULT 'unpaid'
                CHECK (payment_status IN ('unpaid','partial','paid','overpaid')),
            delivery_status TEXT NOT NULL DEFAULT 'not_delivered'
                CHECK (delivery_status IN ('not_delivered','partially_delivered','delivered')),
            total_amount REAL NOT NULL DEFAULT 0,
            paid_amount REAL NOT NULL DEFAULT 0,
            notes TEXT, due_date TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')));

         CREATE TABLE order_items (id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id),
            item_kind TEXT NOT NULL CHECK (item_kind IN ('book','print','service','extra')),
            description TEXT, qty INTEGER NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL DEFAULT 0, total_price REAL NOT NULL DEFAULT 0,
            price_source TEXT NOT NULL DEFAULT 'auto' CHECK (price_source IN ('auto','manual')),
            manual_price_reason TEXT,
            spec_snapshot_json TEXT NOT NULL DEFAULT '{}',
            price_breakdown_json TEXT NOT NULL DEFAULT '{}',
            is_cancelled INTEGER NOT NULL DEFAULT 0,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')));

         CREATE TABLE order_item_books (id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_item_id INTEGER NOT NULL UNIQUE REFERENCES order_items(id),
            book_format_id INTEGER REFERENCES book_formats(id),
            spread_count INTEGER NOT NULL DEFAULT 10,
            block_material_id INTEGER REFERENCES materials(id),
            cover_type_id INTEGER REFERENCES cover_types(id),
            cover_material_id INTEGER REFERENCES cover_materials(id),
            lamination_id INTEGER REFERENCES lamination_types(id));

         CREATE TABLE order_item_prints (id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_item_id INTEGER NOT NULL UNIQUE REFERENCES order_items(id),
            print_format_id INTEGER REFERENCES print_formats(id),
            print_material_id INTEGER REFERENCES materials(id),
            finishing_id INTEGER REFERENCES materials(id));

         CREATE TABLE order_item_extras (id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_item_id INTEGER NOT NULL REFERENCES order_items(id),
            extra_option_type_id INTEGER REFERENCES extra_option_types(id),
            custom_name TEXT, qty INTEGER NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL DEFAULT 0, total_price REAL NOT NULL DEFAULT 0);",
    ).unwrap();

    // v6: Finance
    conn.execute_batch(
        "CREATE TABLE finance_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_type TEXT NOT NULL CHECK (transaction_type IN (
                'order_payment_in','order_refund_out','other_income_in','company_expense_out',
                'transfer_between_accounts','supplier_debt_opened','supplier_debt_paid',
                'partner_paid_company_expense','company_reimbursed_partner',
                'partner_profit_payout','partner_draw','adjustment')),
            amount REAL NOT NULL CHECK (amount >= 0),
            direction TEXT NOT NULL CHECK (direction IN ('in','out','none')),
            account_id INTEGER REFERENCES company_accounts(id),
            counter_account_id INTEGER REFERENCES company_accounts(id),
            linked_transaction_id INTEGER REFERENCES finance_transactions(id),
            order_id INTEGER REFERENCES orders(id),
            liability_id INTEGER, partner_id INTEGER REFERENCES partners(id),
            finance_category_id INTEGER REFERENCES finance_categories(id),
            description TEXT, transaction_date TEXT NOT NULL DEFAULT (date('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')));

         CREATE TABLE liabilities (id INTEGER PRIMARY KEY AUTOINCREMENT,
            liability_type TEXT NOT NULL CHECK (liability_type IN ('supplier_debt','other')),
            counterparty_name TEXT NOT NULL, description TEXT,
            original_amount REAL NOT NULL, paid_amount REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','cancelled')),
            opened_at TEXT NOT NULL DEFAULT (date('now')), due_date TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')));

         CREATE TABLE partner_settlement_entries (id INTEGER PRIMARY KEY AUTOINCREMENT,
            partner_id INTEGER NOT NULL REFERENCES partners(id),
            entry_type TEXT NOT NULL CHECK (entry_type IN (
                'contribution','reimbursement','profit_accrual','profit_payout','draw','adjustment')),
            amount REAL NOT NULL,
            finance_transaction_id INTEGER REFERENCES finance_transactions(id),
            description TEXT, period TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')));

         CREATE TABLE closing_periods (id INTEGER PRIMARY KEY AUTOINCREMENT,
            period TEXT NOT NULL UNIQUE, total_income REAL NOT NULL DEFAULT 0,
            total_expense REAL NOT NULL DEFAULT 0, profit REAL NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
            closed_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));",
    ).unwrap();

    // v7: Order operations
    conn.execute_batch(
        "CREATE TABLE order_payments (id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id),
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card','bank_transfer')),
            account_id INTEGER NOT NULL REFERENCES company_accounts(id),
            finance_transaction_id INTEGER REFERENCES finance_transactions(id),
            notes TEXT, paid_at TEXT NOT NULL DEFAULT (datetime('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')));

         CREATE TABLE order_refunds (id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id),
            amount REAL NOT NULL,
            payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','card','bank_transfer')),
            account_id INTEGER NOT NULL REFERENCES company_accounts(id),
            finance_transaction_id INTEGER REFERENCES finance_transactions(id),
            reason TEXT, refunded_at TEXT NOT NULL DEFAULT (datetime('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')));

         CREATE TABLE order_deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL REFERENCES orders(id),
            delivered_by TEXT, notes TEXT,
            delivered_at TEXT NOT NULL DEFAULT (datetime('now')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')));",
    ).unwrap();

    // v8: Client archiving
    conn.execute_batch("ALTER TABLE clients ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;")
        .unwrap();

    // Seed test data
    seed_test_data(&conn);
    conn
}

fn seed_test_data(conn: &Connection) {
    // Partners
    conn.execute("INSERT INTO partners (name, profit_share) VALUES ('Отец', 0.5)", []).unwrap();
    conn.execute("INSERT INTO partners (name, profit_share) VALUES ('Сын', 0.5)", []).unwrap();

    // Company accounts
    conn.execute("INSERT INTO company_accounts (name, account_type) VALUES ('Касса', 'cash')", []).unwrap();
    conn.execute("INSERT INTO company_accounts (name, account_type) VALUES ('Карта', 'card')", []).unwrap();
    conn.execute("INSERT INTO company_accounts (name, account_type) VALUES ('Банк', 'bank')", []).unwrap();

    // Finance categories
    conn.execute("INSERT INTO finance_categories (name, category_type, is_system) VALUES ('Оплата заказов', 'income', 1)", []).unwrap();
    conn.execute("INSERT INTO finance_categories (name, category_type) VALUES ('Материалы', 'expense')", []).unwrap();
    conn.execute("INSERT INTO finance_categories (name, category_type) VALUES ('Аренда', 'expense')", []).unwrap();

    // Client
    conn.execute("INSERT INTO clients (name, phone) VALUES ('Тест Клиент', '+7 000')", []).unwrap();
}

// ── Helpers ──────────────────────────────────────────────────────────

fn get_id(conn: &Connection, sql: &str) -> i64 {
    conn.query_row(sql, [], |row| row.get(0)).unwrap()
}

fn get_f64(conn: &Connection, sql: &str) -> f64 {
    conn.query_row(sql, [], |row| row.get(0)).unwrap()
}

fn get_str(conn: &Connection, sql: &str) -> String {
    conn.query_row(sql, [], |row| row.get(0)).unwrap()
}

fn cash_id(conn: &Connection) -> i64 {
    get_id(conn, "SELECT id FROM company_accounts WHERE account_type='cash'")
}

fn card_id(conn: &Connection) -> i64 {
    get_id(conn, "SELECT id FROM company_accounts WHERE account_type='card'")
}

fn partner1_id(conn: &Connection) -> i64 {
    get_id(conn, "SELECT id FROM partners ORDER BY id LIMIT 1")
}

fn partner2_id(conn: &Connection) -> i64 {
    get_id(conn, "SELECT id FROM partners ORDER BY id LIMIT 1 OFFSET 1")
}

fn create_order_with_payment(conn: &Connection, amount: f64) -> i64 {
    let client_id = get_id(conn, "SELECT id FROM clients LIMIT 1");
    conn.execute(
        "INSERT INTO orders (number, client_id, production_status, total_amount)
         VALUES ('2603-001', ?1, 'confirmed', ?2)",
        rusqlite::params![client_id, amount],
    ).unwrap();
    let order_id = conn.last_insert_rowid();

    let acc_id = cash_id(conn);
    // Оплата заказа через order_payments (как делает модуль заказов)
    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, order_id, description, transaction_date)
         VALUES ('order_payment_in', ?1, 'in', ?2, ?3, 'Оплата заказа', '2026-03-05')",
        rusqlite::params![amount, acc_id, order_id],
    ).unwrap();
    let ft_id = conn.last_insert_rowid();

    conn.execute(
        "UPDATE company_accounts SET balance = balance + ?1 WHERE id = ?2",
        rusqlite::params![amount, acc_id],
    ).unwrap();

    conn.execute(
        "INSERT INTO order_payments (order_id, amount, payment_method, account_id, finance_transaction_id)
         VALUES (?1, ?2, 'cash', ?3, ?4)",
        rusqlite::params![order_id, amount, acc_id, ft_id],
    ).unwrap();

    conn.execute(
        "UPDATE orders SET paid_amount = ?1, payment_status = 'paid' WHERE id = ?2",
        rusqlite::params![amount, order_id],
    ).unwrap();

    order_id
}

// ═══════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════

mod account_tests {
    use super::*;

    #[test]
    fn test_create_and_list_accounts() {
        let conn = setup_db();
        // Initial: 3 accounts seeded
        let count: i32 = conn.query_row("SELECT COUNT(*) FROM company_accounts", [], |r| r.get(0)).unwrap();
        assert_eq!(count, 3);

        // Create new
        conn.execute(
            "INSERT INTO company_accounts (name, account_type) VALUES ('Новый', 'bank')", [],
        ).unwrap();

        let count2: i32 = conn.query_row("SELECT COUNT(*) FROM company_accounts", [], |r| r.get(0)).unwrap();
        assert_eq!(count2, 4);
    }

    #[test]
    fn test_archive_account_with_zero_balance() {
        let conn = setup_db();
        let bank_id = get_id(&conn, "SELECT id FROM company_accounts WHERE account_type='bank'");

        // Balance is 0, should be archivable
        conn.execute(
            "UPDATE company_accounts SET is_active = 0 WHERE id = ?1",
            rusqlite::params![bank_id],
        ).unwrap();

        let active: i32 = conn.query_row(
            "SELECT is_active FROM company_accounts WHERE id = ?1",
            rusqlite::params![bank_id], |r| r.get(0),
        ).unwrap();
        assert_eq!(active, 0);
    }
}

mod transaction_tests {
    use super::*;

    #[test]
    fn test_register_other_income() {
        let conn = setup_db();
        let acc = cash_id(&conn);

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, description, transaction_date)
             VALUES ('other_income_in', 5000, 'in', ?1, 'Продажа старого оборудования', '2026-03-10')",
            rusqlite::params![acc],
        ).unwrap();

        conn.execute(
            "UPDATE company_accounts SET balance = balance + 5000 WHERE id = ?1",
            rusqlite::params![acc],
        ).unwrap();

        let balance = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {acc}"));
        assert_eq!(balance, 5000.0);

        let tx_type = get_str(&conn, "SELECT transaction_type FROM finance_transactions ORDER BY id DESC LIMIT 1");
        assert_eq!(tx_type, "other_income_in");
    }

    #[test]
    fn test_register_company_expense() {
        let conn = setup_db();
        let acc = card_id(&conn);

        // Дадим начальный баланс
        conn.execute("UPDATE company_accounts SET balance = 20000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, description, transaction_date)
             VALUES ('company_expense_out', 15000, 'out', ?1, 'Аренда помещения', '2026-03-01')",
            rusqlite::params![acc],
        ).unwrap();

        conn.execute(
            "UPDATE company_accounts SET balance = balance - 15000 WHERE id = ?1",
            rusqlite::params![acc],
        ).unwrap();

        let balance = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {acc}"));
        assert_eq!(balance, 5000.0);
    }

    #[test]
    fn test_transfer_between_accounts() {
        let conn = setup_db();
        let from = cash_id(&conn);
        let to = card_id(&conn);

        conn.execute("UPDATE company_accounts SET balance = 10000 WHERE id = ?1", rusqlite::params![from]).unwrap();

        // OUT record
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, counter_account_id, description, transaction_date)
             VALUES ('transfer_between_accounts', 3000, 'out', ?1, ?2, 'Перевод на карту', '2026-03-05')",
            rusqlite::params![from, to],
        ).unwrap();
        let out_id = conn.last_insert_rowid();

        // IN record
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, counter_account_id, linked_transaction_id, description, transaction_date)
             VALUES ('transfer_between_accounts', 3000, 'in', ?1, ?2, ?3, 'Перевод на карту', '2026-03-05')",
            rusqlite::params![to, from, out_id],
        ).unwrap();
        let in_id = conn.last_insert_rowid();

        // Link out -> in
        conn.execute(
            "UPDATE finance_transactions SET linked_transaction_id = ?1 WHERE id = ?2",
            rusqlite::params![in_id, out_id],
        ).unwrap();

        // Update balances
        conn.execute("UPDATE company_accounts SET balance = balance - 3000 WHERE id = ?1", rusqlite::params![from]).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance + 3000 WHERE id = ?1", rusqlite::params![to]).unwrap();

        let from_balance = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {from}"));
        let to_balance = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {to}"));
        assert_eq!(from_balance, 7000.0);
        assert_eq!(to_balance, 3000.0);

        // Total balance unchanged
        let total: f64 = conn.query_row(
            "SELECT SUM(balance) FROM company_accounts", [], |r| r.get(0),
        ).unwrap();
        assert_eq!(total, 10000.0);

        // Two linked records
        let linked: i64 = conn.query_row(
            "SELECT linked_transaction_id FROM finance_transactions WHERE id = ?1",
            rusqlite::params![out_id], |r| r.get(0),
        ).unwrap();
        assert_eq!(linked, in_id);
    }
}

mod liability_tests {
    use super::*;

    #[test]
    fn test_open_supplier_debt() {
        let conn = setup_db();

        conn.execute(
            "INSERT INTO liabilities (liability_type, counterparty_name, description, original_amount, opened_at)
             VALUES ('supplier_debt', 'ООО Фотоматериалы', 'Поставка бумаги', 8000, '2026-03-01')",
            [],
        ).unwrap();
        let lid = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, liability_id, description, transaction_date)
             VALUES ('supplier_debt_opened', 8000, 'none', ?1, 'Открытие долга', '2026-03-01')",
            rusqlite::params![lid],
        ).unwrap();

        let status = get_str(&conn, &format!("SELECT status FROM liabilities WHERE id = {lid}"));
        assert_eq!(status, "open");

        let original = get_f64(&conn, &format!("SELECT original_amount FROM liabilities WHERE id = {lid}"));
        assert_eq!(original, 8000.0);
    }

    #[test]
    fn test_partial_and_full_debt_payment() {
        let conn = setup_db();
        let acc = cash_id(&conn);
        conn.execute("UPDATE company_accounts SET balance = 10000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        // Open debt
        conn.execute(
            "INSERT INTO liabilities (liability_type, counterparty_name, original_amount)
             VALUES ('supplier_debt', 'Поставщик', 5000)",
            [],
        ).unwrap();
        let lid = conn.last_insert_rowid();

        // Partial payment: 3000
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, liability_id, description, transaction_date)
             VALUES ('supplier_debt_paid', 3000, 'out', ?1, ?2, 'Частичная оплата', '2026-03-05')",
            rusqlite::params![acc, lid],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance - 3000 WHERE id = ?1", rusqlite::params![acc]).unwrap();
        conn.execute("UPDATE liabilities SET paid_amount = 3000 WHERE id = ?1", rusqlite::params![lid]).unwrap();

        let paid = get_f64(&conn, &format!("SELECT paid_amount FROM liabilities WHERE id = {lid}"));
        assert_eq!(paid, 3000.0);

        let status = get_str(&conn, &format!("SELECT status FROM liabilities WHERE id = {lid}"));
        assert_eq!(status, "open");

        // Full payment: remaining 2000
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, liability_id, description, transaction_date)
             VALUES ('supplier_debt_paid', 2000, 'out', ?1, ?2, 'Остаток долга', '2026-03-10')",
            rusqlite::params![acc, lid],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance - 2000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        let new_paid: f64 = 3000.0 + 2000.0;
        let original: f64 = 5000.0;
        let new_status = if (new_paid - original).abs() < 0.01 { "paid" } else { "open" };
        conn.execute(
            "UPDATE liabilities SET paid_amount = ?1, status = ?2 WHERE id = ?3",
            rusqlite::params![new_paid, new_status, lid],
        ).unwrap();

        let final_status = get_str(&conn, &format!("SELECT status FROM liabilities WHERE id = {lid}"));
        assert_eq!(final_status, "paid");

        let balance = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {acc}"));
        assert_eq!(balance, 5000.0);
    }

    #[test]
    fn test_father_pays_debt_from_personal_funds() {
        let conn = setup_db();
        let p1 = partner1_id(&conn);
        let acc = cash_id(&conn);

        // Open supplier debt 5000
        conn.execute(
            "INSERT INTO liabilities (liability_type, counterparty_name, original_amount)
             VALUES ('supplier_debt', 'Поставщик', 5000)",
            [],
        ).unwrap();
        let lid = conn.last_insert_rowid();

        // Отец оплатил из личных: partner_paid_company_expense + contribution
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, partner_id, description, transaction_date)
             VALUES ('partner_paid_company_expense', 5000, 'none', ?1, 'Отец закрыл долг поставщику', '2026-03-10')",
            rusqlite::params![p1],
        ).unwrap();
        let ft_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, finance_transaction_id, description)
             VALUES (?1, 'contribution', 5000, ?2, 'Отец закрыл долг поставщику')",
            rusqlite::params![p1, ft_id],
        ).unwrap();

        // Закрываем долг (отмечаем оплату в liabilities)
        conn.execute(
            "UPDATE liabilities SET paid_amount = 5000, status = 'paid' WHERE id = ?1",
            rusqlite::params![lid],
        ).unwrap();

        // Баланс партнёра: contribution = 5000
        let contribution: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'contribution'",
            rusqlite::params![p1], |r| r.get(0),
        ).unwrap();
        assert_eq!(contribution, 5000.0);

        // Баланс счёта не изменился (деньги не проходили через кассу)
        let balance = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {}", acc));
        assert_eq!(balance, 0.0);
    }
}

mod partner_settlement_tests {
    use super::*;

    #[test]
    fn test_partner_contribution_and_reimbursement() {
        let conn = setup_db();
        let p1 = partner1_id(&conn);
        let acc = cash_id(&conn);

        // Contribution: отец внёс 10000 в кассу
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
             VALUES ('partner_paid_company_expense', 10000, 'none', ?1, ?2, 'Вклад в бизнес', '2026-03-01')",
            rusqlite::params![acc, p1],
        ).unwrap();
        let ft_id = conn.last_insert_rowid();

        conn.execute("UPDATE company_accounts SET balance = balance + 10000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        conn.execute(
            "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, finance_transaction_id, description)
             VALUES (?1, 'contribution', 10000, ?2, 'Вклад в бизнес')",
            rusqlite::params![p1, ft_id],
        ).unwrap();

        // Reimbursement: компания вернула 3000
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
             VALUES ('company_reimbursed_partner', 3000, 'out', ?1, ?2, 'Возврат части вклада', '2026-03-15')",
            rusqlite::params![acc, p1],
        ).unwrap();
        let ft_id2 = conn.last_insert_rowid();

        conn.execute("UPDATE company_accounts SET balance = balance - 3000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        conn.execute(
            "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, finance_transaction_id, description)
             VALUES (?1, 'reimbursement', 3000, ?2, 'Возврат части вклада')",
            rusqlite::params![p1, ft_id2],
        ).unwrap();

        // Balance: 10000 - 3000 = 7000
        let contributions: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'contribution'",
            rusqlite::params![p1], |r| r.get(0),
        ).unwrap();
        let reimbursements: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'reimbursement'",
            rusqlite::params![p1], |r| r.get(0),
        ).unwrap();

        let balance = contributions - reimbursements;
        assert_eq!(balance, 7000.0);

        // Account balance: 7000
        let acc_balance = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {acc}"));
        assert_eq!(acc_balance, 7000.0);
    }

    #[test]
    fn test_partner_draw() {
        let conn = setup_db();
        let p1 = partner1_id(&conn);
        let p2 = partner2_id(&conn);
        let acc = cash_id(&conn);

        // Дадим начальный баланс
        conn.execute("UPDATE company_accounts SET balance = 20000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        // Оба партнёра берут draw
        for (pid, amount) in [(p1, 3000.0f64), (p2, 2000.0f64)] {
            conn.execute(
                "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
                 VALUES ('partner_draw', ?1, 'out', ?2, ?3, 'Draw', '2026-03-15')",
                rusqlite::params![amount, acc, pid],
            ).unwrap();
            let ft_id = conn.last_insert_rowid();

            conn.execute("UPDATE company_accounts SET balance = balance - ?1 WHERE id = ?2", rusqlite::params![amount, acc]).unwrap();

            conn.execute(
                "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, finance_transaction_id, description)
                 VALUES (?1, 'draw', ?2, ?3, 'Draw')",
                rusqlite::params![pid, amount, ft_id],
            ).unwrap();
        }

        // Check draws
        let draw1: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'draw'",
            rusqlite::params![p1], |r| r.get(0),
        ).unwrap();
        assert_eq!(draw1, 3000.0);

        let draw2: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'draw'",
            rusqlite::params![p2], |r| r.get(0),
        ).unwrap();
        assert_eq!(draw2, 2000.0);

        // Balance after draws: 20000 - 3000 - 2000 = 15000
        let acc_balance = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {acc}"));
        assert_eq!(acc_balance, 15000.0);
    }
}

mod closing_period_tests {
    use super::*;

    #[test]
    fn test_close_period_calculates_profit_and_accrues() {
        let conn = setup_db();
        let acc = cash_id(&conn);
        let card = card_id(&conn);
        let p1 = partner1_id(&conn);
        let p2 = partner2_id(&conn);

        // Income: клиент оплатил заказ 20000
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");
        conn.execute(
            "INSERT INTO orders (number, client_id, production_status, total_amount, paid_amount, payment_status)
             VALUES ('2603-001', ?1, 'confirmed', 20000, 20000, 'paid')",
            rusqlite::params![client_id],
        ).unwrap();
        let order_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, order_id, description, transaction_date)
             VALUES ('order_payment_in', 20000, 'in', ?1, ?2, 'Оплата заказа', '2026-03-05')",
            rusqlite::params![acc, order_id],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance + 20000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        // Other income: 5000
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, description, transaction_date)
             VALUES ('other_income_in', 5000, 'in', ?1, 'Прочий доход', '2026-03-10')",
            rusqlite::params![acc],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance + 5000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        // Expenses: материалы 3000 + аренда 7000
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, description, transaction_date)
             VALUES ('company_expense_out', 3000, 'out', ?1, 'Материалы', '2026-03-03')",
            rusqlite::params![acc],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance - 3000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, description, transaction_date)
             VALUES ('company_expense_out', 7000, 'out', ?1, 'Аренда', '2026-03-01')",
            rusqlite::params![card],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance - 7000 WHERE id = ?1", rusqlite::params![card]).unwrap();

        // Close period 2026-03
        let period = "2026-03";
        let period_start = "2026-03-01";
        let period_end = "2026-04-01";

        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM finance_transactions
             WHERE transaction_type IN ('order_payment_in', 'other_income_in')
             AND transaction_date >= ?1 AND transaction_date < ?2",
            rusqlite::params![period_start, period_end], |r| r.get(0),
        ).unwrap();
        assert_eq!(total_income, 25000.0); // 20000 + 5000

        let total_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM finance_transactions
             WHERE transaction_type IN ('company_expense_out', 'supplier_debt_paid', 'order_refund_out')
             AND transaction_date >= ?1 AND transaction_date < ?2",
            rusqlite::params![period_start, period_end], |r| r.get(0),
        ).unwrap();
        assert_eq!(total_expense, 10000.0); // 3000 + 7000

        let profit = total_income - total_expense;
        assert_eq!(profit, 15000.0);

        // Create closing period
        conn.execute(
            "INSERT INTO closing_periods (period, total_income, total_expense, profit, status, closed_at)
             VALUES (?1, ?2, ?3, ?4, 'closed', datetime('now'))",
            rusqlite::params![period, total_income, total_expense, profit],
        ).unwrap();

        // Accrue profit 50/50
        let partners: Vec<(i64, f64)> = vec![(p1, 0.5), (p2, 0.5)];
        for (pid, share) in &partners {
            let accrual = profit * share;
            conn.execute(
                "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, description, period)
                 VALUES (?1, 'profit_accrual', ?2, ?3, ?4)",
                rusqlite::params![pid, accrual, format!("Начисление прибыли за {period}"), period],
            ).unwrap();
        }

        // Verify accruals
        let accrual1: f64 = conn.query_row(
            "SELECT amount FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'profit_accrual' AND period = ?2",
            rusqlite::params![p1, period], |r| r.get(0),
        ).unwrap();
        assert_eq!(accrual1, 7500.0);

        let accrual2: f64 = conn.query_row(
            "SELECT amount FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'profit_accrual' AND period = ?2",
            rusqlite::params![p2, period], |r| r.get(0),
        ).unwrap();
        assert_eq!(accrual2, 7500.0);

        // Verify closing period record
        let cp_status = get_str(&conn, &format!("SELECT status FROM closing_periods WHERE period = '{period}'"));
        assert_eq!(cp_status, "closed");
    }

    #[test]
    fn test_duplicate_closing_prevented() {
        let conn = setup_db();
        let period = "2026-03";

        conn.execute(
            "INSERT INTO closing_periods (period, total_income, total_expense, profit, status, closed_at)
             VALUES (?1, 1000, 500, 500, 'closed', datetime('now'))",
            rusqlite::params![period],
        ).unwrap();

        // Duplicate insert should fail due to UNIQUE constraint
        let result = conn.execute(
            "INSERT INTO closing_periods (period, total_income, total_expense, profit, status, closed_at)
             VALUES (?1, 2000, 1000, 1000, 'closed', datetime('now'))",
            rusqlite::params![period],
        );

        assert!(result.is_err());
    }

    #[test]
    fn test_force_reclose_period() {
        let conn = setup_db();
        let period = "2026-03";
        let p1 = partner1_id(&conn);
        let p2 = partner2_id(&conn);

        // First close
        conn.execute(
            "INSERT INTO closing_periods (period, total_income, total_expense, profit, status, closed_at)
             VALUES (?1, 1000, 500, 500, 'closed', datetime('now'))",
            rusqlite::params![period],
        ).unwrap();

        conn.execute(
            "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, period)
             VALUES (?1, 'profit_accrual', 250, ?2)",
            rusqlite::params![p1, period],
        ).unwrap();
        conn.execute(
            "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, period)
             VALUES (?1, 'profit_accrual', 250, ?2)",
            rusqlite::params![p2, period],
        ).unwrap();

        // Force reclose: delete old and recreate
        conn.execute(
            "DELETE FROM partner_settlement_entries WHERE period = ?1 AND entry_type = 'profit_accrual'",
            rusqlite::params![period],
        ).unwrap();
        conn.execute("DELETE FROM closing_periods WHERE period = ?1", rusqlite::params![period]).unwrap();

        // New data
        conn.execute(
            "INSERT INTO closing_periods (period, total_income, total_expense, profit, status, closed_at)
             VALUES (?1, 2000, 500, 1500, 'closed', datetime('now'))",
            rusqlite::params![period],
        ).unwrap();

        for pid in [p1, p2] {
            conn.execute(
                "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, period)
                 VALUES (?1, 'profit_accrual', 750, ?2)",
                rusqlite::params![pid, period],
            ).unwrap();
        }

        let new_profit = get_f64(&conn, &format!("SELECT profit FROM closing_periods WHERE period = '{period}'"));
        assert_eq!(new_profit, 1500.0);

        let accrual: f64 = conn.query_row(
            "SELECT amount FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'profit_accrual' AND period = ?2",
            rusqlite::params![p1, period], |r| r.get(0),
        ).unwrap();
        assert_eq!(accrual, 750.0);
    }
}

mod full_scenario_tests {
    use super::*;

    /// Полный сценарий:
    /// 1. Клиент оплатил заказ 20000
    /// 2. Компания купила материалы 3000
    /// 3. Поставщик дал в долг 8000
    /// 4. Отец закрыл долг поставщику из личных (5000)
    /// 5. Компания вернула часть отцу (2000)
    /// 6. Оба партнёра забрали draw (1000 каждый)
    /// 7. Закрытие периода, прибыль 50/50
    #[test]
    fn test_full_business_cycle() {
        let conn = setup_db();
        let acc = cash_id(&conn);
        let p1 = partner1_id(&conn);
        let p2 = partner2_id(&conn);

        // 1. Клиент оплатил заказ 20000
        let _order_id = create_order_with_payment(&conn, 20000.0);
        let balance_after_payment = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {acc}"));
        assert_eq!(balance_after_payment, 20000.0);

        // 2. Компания купила материалы 3000
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, description, transaction_date)
             VALUES ('company_expense_out', 3000, 'out', ?1, 'Покупка материалов', '2026-03-06')",
            rusqlite::params![acc],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance - 3000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        // 3. Поставщик дал в долг 8000
        conn.execute(
            "INSERT INTO liabilities (liability_type, counterparty_name, original_amount, opened_at)
             VALUES ('supplier_debt', 'ООО Фотоматериалы', 8000, '2026-03-07')",
            [],
        ).unwrap();
        let lid = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, liability_id, description, transaction_date)
             VALUES ('supplier_debt_opened', 8000, 'none', ?1, 'Долг поставщику', '2026-03-07')",
            rusqlite::params![lid],
        ).unwrap();

        // 4. Отец закрыл часть долга из личных (5000)
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, partner_id, liability_id, description, transaction_date)
             VALUES ('partner_paid_company_expense', 5000, 'none', ?1, ?2, 'Отец оплатил долг', '2026-03-08')",
            rusqlite::params![p1, lid],
        ).unwrap();
        let ft_contrib = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, finance_transaction_id, description)
             VALUES (?1, 'contribution', 5000, ?2, 'Оплата долга поставщику')",
            rusqlite::params![p1, ft_contrib],
        ).unwrap();

        conn.execute(
            "UPDATE liabilities SET paid_amount = 5000 WHERE id = ?1",
            rusqlite::params![lid],
        ).unwrap();

        // Остаток долга 3000 — оплатим со счёта компании
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, liability_id, description, transaction_date)
             VALUES ('supplier_debt_paid', 3000, 'out', ?1, ?2, 'Оплата остатка долга', '2026-03-09')",
            rusqlite::params![acc, lid],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance - 3000 WHERE id = ?1", rusqlite::params![acc]).unwrap();
        conn.execute("UPDATE liabilities SET paid_amount = 8000, status = 'paid' WHERE id = ?1", rusqlite::params![lid]).unwrap();

        // 5. Компания вернула отцу 2000
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
             VALUES ('company_reimbursed_partner', 2000, 'out', ?1, ?2, 'Возмещение отцу', '2026-03-10')",
            rusqlite::params![acc, p1],
        ).unwrap();
        let ft_reimb = conn.last_insert_rowid();
        conn.execute("UPDATE company_accounts SET balance = balance - 2000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        conn.execute(
            "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, finance_transaction_id, description)
             VALUES (?1, 'reimbursement', 2000, ?2, 'Возмещение отцу')",
            rusqlite::params![p1, ft_reimb],
        ).unwrap();

        // 6. Оба партнёра забрали draw по 1000
        for pid in [p1, p2] {
            conn.execute(
                "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
                 VALUES ('partner_draw', 1000, 'out', ?1, ?2, 'Draw', '2026-03-12')",
                rusqlite::params![acc, pid],
            ).unwrap();
            let ft_draw = conn.last_insert_rowid();
            conn.execute("UPDATE company_accounts SET balance = balance - 1000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

            conn.execute(
                "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, finance_transaction_id, description)
                 VALUES (?1, 'draw', 1000, ?2, 'Draw')",
                rusqlite::params![pid, ft_draw],
            ).unwrap();
        }

        // Проверяем баланс кассы: 20000 - 3000 - 3000 - 2000 - 1000 - 1000 = 10000
        let final_cash = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {acc}"));
        assert_eq!(final_cash, 10000.0);

        // 7. Закрытие периода
        let period = "2026-03";
        let period_start = "2026-03-01";
        let period_end = "2026-04-01";

        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM finance_transactions
             WHERE transaction_type IN ('order_payment_in', 'other_income_in')
             AND transaction_date >= ?1 AND transaction_date < ?2",
            rusqlite::params![period_start, period_end], |r| r.get(0),
        ).unwrap();
        assert_eq!(total_income, 20000.0);

        let total_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM finance_transactions
             WHERE transaction_type IN ('company_expense_out', 'supplier_debt_paid', 'order_refund_out')
             AND transaction_date >= ?1 AND transaction_date < ?2",
            rusqlite::params![period_start, period_end], |r| r.get(0),
        ).unwrap();
        // 3000 (materials) + 3000 (debt paid from account) = 6000
        assert_eq!(total_expense, 6000.0);

        let profit = total_income - total_expense;
        assert_eq!(profit, 14000.0);

        conn.execute(
            "INSERT INTO closing_periods (period, total_income, total_expense, profit, status, closed_at)
             VALUES (?1, ?2, ?3, ?4, 'closed', datetime('now'))",
            rusqlite::params![period, total_income, total_expense, profit],
        ).unwrap();

        // Accrue 50/50
        for pid in [p1, p2] {
            conn.execute(
                "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, description, period)
                 VALUES (?1, 'profit_accrual', ?2, 'Прибыль за март', ?3)",
                rusqlite::params![pid, 7000.0, period],
            ).unwrap();
        }

        // Partner summary for Отец (p1):
        // contributions=5000, reimbursements=2000, profit_accrued=7000, draws=1000
        // balance = 5000 + 7000 - 0 - 1000 - 2000 = 9000
        let p1_contrib: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'contribution'",
            rusqlite::params![p1], |r| r.get(0),
        ).unwrap();
        let p1_reimb: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'reimbursement'",
            rusqlite::params![p1], |r| r.get(0),
        ).unwrap();
        let p1_accrual: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'profit_accrual'",
            rusqlite::params![p1], |r| r.get(0),
        ).unwrap();
        let p1_draw: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'draw'",
            rusqlite::params![p1], |r| r.get(0),
        ).unwrap();

        assert_eq!(p1_contrib, 5000.0);
        assert_eq!(p1_reimb, 2000.0);
        assert_eq!(p1_accrual, 7000.0);
        assert_eq!(p1_draw, 1000.0);

        let p1_balance = p1_contrib + p1_accrual - 0.0 - p1_draw - p1_reimb;
        assert_eq!(p1_balance, 9000.0); // Компания должна отцу 9000

        // Partner summary for Сын (p2):
        // contributions=0, reimbursements=0, profit_accrued=7000, draws=1000
        // balance = 0 + 7000 - 0 - 1000 - 0 = 6000
        let p2_accrual: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'profit_accrual'",
            rusqlite::params![p2], |r| r.get(0),
        ).unwrap();
        let p2_draw: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'draw'",
            rusqlite::params![p2], |r| r.get(0),
        ).unwrap();

        let p2_balance = p2_accrual - p2_draw;
        assert_eq!(p2_balance, 6000.0); // Компания должна сыну 6000

        // Supplier debt fully paid
        let debt_status = get_str(&conn, &format!("SELECT status FROM liabilities WHERE id = {lid}"));
        assert_eq!(debt_status, "paid");

        // Outstanding supplier debt = 0
        let outstanding: f64 = conn.query_row(
            "SELECT COALESCE(SUM(original_amount - paid_amount), 0) FROM liabilities WHERE status = 'open'",
            [], |r| r.get(0),
        ).unwrap();
        assert_eq!(outstanding, 0.0);
    }

    #[test]
    fn test_order_payment_visible_in_finance_queries() {
        let conn = setup_db();
        let acc = cash_id(&conn);

        // Оплата заказа создаёт finance_transaction через модуль заказов
        let _order_id = create_order_with_payment(&conn, 10000.0);

        // Finance query должен видеть эту транзакцию
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM finance_transactions WHERE transaction_type = 'order_payment_in'",
            [], |r| r.get(0),
        ).unwrap();
        assert_eq!(count, 1);

        let income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM finance_transactions
             WHERE transaction_type IN ('order_payment_in', 'other_income_in')",
            [], |r| r.get(0),
        ).unwrap();
        assert_eq!(income, 10000.0);

        // Баланс кассы
        let balance = get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {acc}"));
        assert_eq!(balance, 10000.0);
    }

    #[test]
    fn test_negative_profit_period() {
        let conn = setup_db();
        let acc = cash_id(&conn);
        let p1 = partner1_id(&conn);
        let p2 = partner2_id(&conn);

        // Only expense, no income
        conn.execute("UPDATE company_accounts SET balance = 50000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, description, transaction_date)
             VALUES ('company_expense_out', 30000, 'out', ?1, 'Большой расход', '2026-03-15')",
            rusqlite::params![acc],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance - 30000 WHERE id = ?1", rusqlite::params![acc]).unwrap();

        // Close period
        let period = "2026-03";
        let total_income: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM finance_transactions
             WHERE transaction_type IN ('order_payment_in', 'other_income_in')
             AND transaction_date >= '2026-03-01' AND transaction_date < '2026-04-01'",
            [], |r| r.get(0),
        ).unwrap();
        assert_eq!(total_income, 0.0);

        let total_expense: f64 = conn.query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM finance_transactions
             WHERE transaction_type IN ('company_expense_out', 'supplier_debt_paid', 'order_refund_out')
             AND transaction_date >= '2026-03-01' AND transaction_date < '2026-04-01'",
            [], |r| r.get(0),
        ).unwrap();
        assert_eq!(total_expense, 30000.0);

        let profit = total_income - total_expense;
        assert_eq!(profit, -30000.0);

        // Negative accrual is valid
        for pid in [p1, p2] {
            conn.execute(
                "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, period)
                 VALUES (?1, 'profit_accrual', ?2, ?3)",
                rusqlite::params![pid, -15000.0, period],
            ).unwrap();
        }

        let accrual: f64 = conn.query_row(
            "SELECT amount FROM partner_settlement_entries WHERE partner_id = ?1 AND entry_type = 'profit_accrual'",
            rusqlite::params![p1], |r| r.get(0),
        ).unwrap();
        assert_eq!(accrual, -15000.0);
    }
}

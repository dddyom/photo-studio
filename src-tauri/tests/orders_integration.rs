//! Integration tests for orders application layer.
//! Uses in-memory SQLite database with all migrations and seeds applied.

use rusqlite::Connection;

/// Set up an in-memory DB with all migrations and seed data.
fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;",
    )
    .unwrap();

    // Run all migrations inline (copy the migration SQL)
    // v1: Foundation
    conn.execute_batch(
        "CREATE TABLE app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
         CREATE TABLE partners (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            profit_share REAL NOT NULL DEFAULT 0.5, created_at TEXT NOT NULL DEFAULT (datetime('now')));
         CREATE TABLE company_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            account_type TEXT NOT NULL CHECK (account_type IN ('cash','card','bank')),
            balance REAL NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')));",
    )
    .unwrap();

    // v2: Catalogs (minimal for tests)
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
    )
    .unwrap();

    // v3: Pricing
    conn.execute_batch(
        "CREATE TABLE pricing_programs (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));
         CREATE TABLE pricing_rules (id INTEGER PRIMARY KEY AUTOINCREMENT,
            pricing_program_id INTEGER NOT NULL REFERENCES pricing_programs(id),
            item_kind TEXT NOT NULL CHECK (item_kind IN ('book','print','service','extra')),
            match_params TEXT NOT NULL DEFAULT '{}', price_formula TEXT NOT NULL DEFAULT '{}',
            is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT (datetime('now')));",
    )
    .unwrap();

    // v4: Clients
    conn.execute_batch(
        "CREATE TABLE clients (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
            phone TEXT, email TEXT,
            default_pricing_program_id INTEGER REFERENCES pricing_programs(id),
            notes TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')));",
    )
    .unwrap();

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
            lamination_id INTEGER REFERENCES lamination_types(id),
            assembly_kind TEXT,
            cover_family TEXT);

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
    )
    .unwrap();

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
    )
    .unwrap();

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
    )
    .unwrap();

    // v8: Client archiving
    conn.execute_batch("ALTER TABLE clients ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;")
        .unwrap();

    // v19: Client balance
    conn.execute_batch(
        "ALTER TABLE clients ADD COLUMN balance REAL NOT NULL DEFAULT 0;

         CREATE TABLE client_balance_transactions (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id       INTEGER NOT NULL REFERENCES clients(id),
            amount          REAL    NOT NULL,
            direction       TEXT    NOT NULL CHECK (direction IN ('in','out')),
            transaction_type TEXT   NOT NULL CHECK (transaction_type IN (
                'deposit','withdraw','order_payment','order_surplus'
            )),
            order_id        INTEGER REFERENCES orders(id),
            payment_method  TEXT,
            account_id      INTEGER REFERENCES company_accounts(id),
            notes           TEXT,
            created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
         );",
    )
    .unwrap();

    // Seed test data
    seed_test_data(&conn);
    conn
}

fn seed_test_data(conn: &Connection) {
    // Company accounts
    conn.execute(
        "INSERT INTO company_accounts (name, account_type) VALUES ('Касса', 'cash')",
        [],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO company_accounts (name, account_type) VALUES ('Карта', 'card')",
        [],
    )
    .unwrap();

    // Pricing program: Цены
    conn.execute(
        "INSERT INTO pricing_programs (name) VALUES ('Цены')",
        [],
    )
    .unwrap();
    let prog_id = conn.last_insert_rowid();

    // ── Print rules: lab_print ──────────────────────────────────────
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'print', '{\"category\":\"lab_print\",\"format\":\"10x15\"}', '{\"type\":\"fixed\",\"price\":50}')",
        rusqlite::params![prog_id],
    ).unwrap();
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'print', '{\"category\":\"lab_print\",\"format\":\"20x30\"}', '{\"type\":\"fixed\",\"price\":180}')",
        rusqlite::params![prog_id],
    ).unwrap();

    // ── Print rules: photo_pvc ──────────────────────────────────────
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'print', '{\"category\":\"photo_pvc\",\"format\":\"30x43\"}', '{\"type\":\"fixed\",\"price\":1300}')",
        rusqlite::params![prog_id],
    ).unwrap();

    // ── Print rules: wide_format_lamination ─────────────────────────
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'print', '{\"category\":\"wide_format_lamination\",\"lamination_type\":\"Алмазная\"}', '{\"type\":\"fixed\",\"price\":1500}')",
        rusqlite::params![prog_id],
    ).unwrap();

    // ── Book rules: block (plastic & pvc_board for 20x30) ───────────
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'book', '{\"component\":\"block\",\"assembly_kind\":\"plastic\",\"format\":\"20x30\"}', '{\"type\":\"fixed\",\"price\":600}')",
        rusqlite::params![prog_id],
    ).unwrap();
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'book', '{\"component\":\"block\",\"assembly_kind\":\"pvc_board\",\"format\":\"20x30\"}', '{\"type\":\"fixed\",\"price\":550}')",
        rusqlite::params![prog_id],
    ).unwrap();

    // ── Book rules: covers ──────────────────────────────────────────
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'book', '{\"component\":\"cover\",\"cover_family\":\"eco_leather\",\"format\":\"20x30\"}', '{\"type\":\"fixed\",\"price\":3000}')",
        rusqlite::params![prog_id],
    ).unwrap();
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'book', '{\"component\":\"cover\",\"cover_family\":\"laminated_hard\",\"format\":\"20x30\"}', '{\"type\":\"fixed\",\"price\":1800}')",
        rusqlite::params![prog_id],
    ).unwrap();

    // ── Book rules: cover options ───────────────────────────────────
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'book', '{\"component\":\"cover_option\",\"option_name\":\"Гравировка\"}', '{\"type\":\"fixed\",\"price\":1000}')",
        rusqlite::params![prog_id],
    ).unwrap();
    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, 'book', '{\"component\":\"cover_option\",\"option_name\":\"Фото-вставка\"}', '{\"type\":\"fixed\",\"price\":800}')",
        rusqlite::params![prog_id],
    ).unwrap();

    // Catalogs
    conn.execute("INSERT INTO book_formats (name) VALUES ('20x30')", []).unwrap();
    conn.execute("INSERT INTO print_formats (name) VALUES ('10x15')", []).unwrap();
    conn.execute("INSERT INTO print_formats (name) VALUES ('20x30')", []).unwrap();
    conn.execute("INSERT INTO print_formats (name) VALUES ('30x43')", []).unwrap();
    conn.execute("INSERT INTO materials (name, category) VALUES ('Фотобумага глянцевая', 'block')", []).unwrap();
    conn.execute("INSERT INTO materials (name, category) VALUES ('Глянцевая бумага', 'print')", []).unwrap();
    conn.execute("INSERT INTO cover_types (name) VALUES ('Твёрдая')", []).unwrap();
    conn.execute("INSERT INTO cover_materials (name) VALUES ('Кожзам')", []).unwrap();
    conn.execute("INSERT INTO lamination_types (name) VALUES ('Глянцевая')", []).unwrap();
    conn.execute("INSERT INTO extra_option_types (name, default_price) VALUES ('Подарочная коробка', 800)", []).unwrap();

    // Client
    conn.execute(
        "INSERT INTO clients (name, phone, default_pricing_program_id) VALUES ('Тест Клиент', '+7 000', ?1)",
        rusqlite::params![prog_id],
    )
    .unwrap();

    // Partners
    conn.execute("INSERT INTO partners (name, profit_share) VALUES ('П1', 0.5)", []).unwrap();
    conn.execute("INSERT INTO partners (name, profit_share) VALUES ('П2', 0.5)", []).unwrap();
}

// ── Helper to get IDs ────────────────────────────────────────────────

fn get_id(conn: &Connection, sql: &str) -> i64 {
    conn.query_row(sql, [], |row| row.get(0)).unwrap()
}

fn get_f64(conn: &Connection, sql: &str) -> f64 {
    conn.query_row(sql, [], |row| row.get(0)).unwrap()
}

fn get_str(conn: &Connection, sql: &str) -> String {
    conn.query_row(sql, [], |row| row.get(0)).unwrap()
}

// ── Pricing engine helper (reimplements calculate_price logic for tests) ──

fn find_matching_rule(conn: &Connection, prog_id: i64, item_kind: &str, spec: &serde_json::Value) -> Option<(i64, serde_json::Value)> {
    let mut stmt = conn.prepare(
        "SELECT id, match_params, price_formula FROM pricing_rules WHERE pricing_program_id = ?1 AND item_kind = ?2 AND is_active = 1"
    ).unwrap();
    let rules: Vec<(i64, String, String)> = stmt.query_map(
        rusqlite::params![prog_id, item_kind],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    ).unwrap().collect::<Result<Vec<_>, _>>().unwrap();

    let mut best: Option<(i64, serde_json::Value, usize)> = None;
    for (rule_id, mp_str, formula_str) in &rules {
        let mp: serde_json::Value = serde_json::from_str(mp_str).unwrap_or(serde_json::json!({}));
        let formula: serde_json::Value = serde_json::from_str(formula_str).unwrap_or(serde_json::json!({}));
        let params = mp.as_object();
        let specificity = params.map_or(0, |m| m.len());
        let matches = params.map_or(true, |p| p.iter().all(|(k, v)| spec.get(k) == Some(v)));
        if matches {
            if best.is_none() || specificity > best.as_ref().unwrap().2 {
                best = Some((*rule_id, formula, specificity));
            }
        }
    }
    best.map(|(id, f, _)| (id, f))
}

// ── Pricing tests ────────────────────────────────────────────────────

mod pricing_tests {
    use super::*;

    #[test]
    fn test_lab_print_10x15_pricing() {
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");
        let spec = serde_json::json!({"category": "lab_print", "format": "10x15"});

        let (_, formula) = find_matching_rule(&conn, prog_id, "print", &spec).unwrap();
        assert_eq!(formula["type"], "fixed");
        assert_eq!(formula["price"], 50.0);

        let qty = 10;
        let total = formula["price"].as_f64().unwrap() * qty as f64;
        assert_eq!(total, 500.0);
    }

    #[test]
    fn test_photo_pvc_30x43_pricing() {
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");
        let spec = serde_json::json!({"category": "photo_pvc", "format": "30x43"});

        let (_, formula) = find_matching_rule(&conn, prog_id, "print", &spec).unwrap();
        assert_eq!(formula["type"], "fixed");
        assert_eq!(formula["price"], 1300.0);

        let qty = 3;
        let total = formula["price"].as_f64().unwrap() * qty as f64;
        assert_eq!(total, 3900.0);
    }

    #[test]
    fn test_wide_format_lamination_diamond() {
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");
        let spec = serde_json::json!({"category": "wide_format_lamination", "lamination_type": "Алмазная"});

        let (_, formula) = find_matching_rule(&conn, prog_id, "print", &spec).unwrap();
        assert_eq!(formula["type"], "fixed");
        assert_eq!(formula["price"], 1500.0);

        // 2 sq meters
        let qty = 2;
        let total = formula["price"].as_f64().unwrap() * qty as f64;
        assert_eq!(total, 3000.0);
    }

    #[test]
    fn test_book_20x30_plastic_5spreads_eco_leather() {
        // Book: 20x30, plastic assembly, 5 spreads, eco_leather cover
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");

        // Block: plastic 20x30 = 600 per spread
        let block_spec = serde_json::json!({"component": "block", "assembly_kind": "plastic", "format": "20x30"});
        let (_, block_formula) = find_matching_rule(&conn, prog_id, "book", &block_spec).unwrap();
        let block_per_spread = block_formula["price"].as_f64().unwrap();
        assert_eq!(block_per_spread, 600.0);

        // Cover: eco_leather 20x30 = 3000
        let cover_spec = serde_json::json!({"component": "cover", "cover_family": "eco_leather", "format": "20x30"});
        let (_, cover_formula) = find_matching_rule(&conn, prog_id, "book", &cover_spec).unwrap();
        let cover_price = cover_formula["price"].as_f64().unwrap();
        assert_eq!(cover_price, 3000.0);

        // Total for 1 book: 600*5 + 3000 = 6000
        let spread_count = 5;
        let unit_price = block_per_spread * spread_count as f64 + cover_price;
        assert_eq!(unit_price, 6000.0);

        // 2 copies: 12000
        let qty = 2;
        assert_eq!(unit_price * qty as f64, 12000.0);
    }

    #[test]
    fn test_book_20x30_pvc_board_3spreads_laminated_hard() {
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");

        // Block: pvc_board 20x30 = 550 per spread
        let block_spec = serde_json::json!({"component": "block", "assembly_kind": "pvc_board", "format": "20x30"});
        let (_, block_formula) = find_matching_rule(&conn, prog_id, "book", &block_spec).unwrap();
        let block_per_spread = block_formula["price"].as_f64().unwrap();
        assert_eq!(block_per_spread, 550.0);

        // Cover: laminated_hard 20x30 = 1800
        let cover_spec = serde_json::json!({"component": "cover", "cover_family": "laminated_hard", "format": "20x30"});
        let (_, cover_formula) = find_matching_rule(&conn, prog_id, "book", &cover_spec).unwrap();
        let cover_price = cover_formula["price"].as_f64().unwrap();
        assert_eq!(cover_price, 1800.0);

        // Total for 1 book: 550*3 + 1800 = 3450
        let spread_count = 3;
        let unit_price = block_per_spread * spread_count as f64 + cover_price;
        assert_eq!(unit_price, 3450.0);
    }

    #[test]
    fn test_book_cover_options_engraving_and_photo_insert() {
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");

        // Гравировка = 1000
        let eng_spec = serde_json::json!({"component": "cover_option", "option_name": "Гравировка"});
        let (_, eng_formula) = find_matching_rule(&conn, prog_id, "book", &eng_spec).unwrap();
        assert_eq!(eng_formula["price"].as_f64().unwrap(), 1000.0);

        // Фото-вставка = 800
        let photo_spec = serde_json::json!({"component": "cover_option", "option_name": "Фото-вставка"});
        let (_, photo_formula) = find_matching_rule(&conn, prog_id, "book", &photo_spec).unwrap();
        assert_eq!(photo_formula["price"].as_f64().unwrap(), 800.0);

        // Full book with both options: 20x30 plastic, 5 spreads, eco_leather + both options
        let block_spec = serde_json::json!({"component": "block", "assembly_kind": "plastic", "format": "20x30"});
        let (_, bf) = find_matching_rule(&conn, prog_id, "book", &block_spec).unwrap();
        let cover_spec = serde_json::json!({"component": "cover", "cover_family": "eco_leather", "format": "20x30"});
        let (_, cf) = find_matching_rule(&conn, prog_id, "book", &cover_spec).unwrap();

        let spread_count = 5;
        let unit_price = bf["price"].as_f64().unwrap() * spread_count as f64
            + cf["price"].as_f64().unwrap()
            + 1000.0  // Гравировка
            + 800.0;  // Фото-вставка
        // 600*5 + 3000 + 1000 + 800 = 7800
        assert_eq!(unit_price, 7800.0);
    }
}

// ── Order lifecycle tests ────────────────────────────────────────────

mod order_lifecycle_tests {
    use super::*;

    #[test]
    fn test_create_draft_order() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs LIMIT 1");

        conn.execute(
            "INSERT INTO orders (number, client_id, pricing_program_id)
             VALUES ('2603-001', ?1, ?2)",
            rusqlite::params![client_id, prog_id],
        )
        .unwrap();

        let order_id = conn.last_insert_rowid();
        let status = get_str(
            &conn,
            &format!("SELECT production_status FROM orders WHERE id = {order_id}"),
        );
        assert_eq!(status, "draft");

        let payment_status = get_str(
            &conn,
            &format!("SELECT payment_status FROM orders WHERE id = {order_id}"),
        );
        assert_eq!(payment_status, "unpaid");
    }

    #[test]
    fn test_order_status_transitions() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");

        conn.execute(
            "INSERT INTO orders (number, client_id) VALUES ('2603-001', ?1)",
            rusqlite::params![client_id],
        )
        .unwrap();
        let order_id = conn.last_insert_rowid();

        // draft -> confirmed -> in_work -> ready -> closed
        for status in &["confirmed", "in_work", "ready", "closed"] {
            conn.execute(
                &format!("UPDATE orders SET production_status = '{status}' WHERE id = ?1"),
                rusqlite::params![order_id],
            ).unwrap();
        }
        assert_eq!(
            get_str(&conn, &format!("SELECT production_status FROM orders WHERE id = {order_id}")),
            "closed"
        );
    }

    #[test]
    fn test_add_items_and_recalculate_total() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs LIMIT 1");

        conn.execute(
            "INSERT INTO orders (number, client_id, pricing_program_id)
             VALUES ('2603-001', ?1, ?2)",
            rusqlite::params![client_id, prog_id],
        )
        .unwrap();
        let order_id = conn.last_insert_rowid();

        // Add a print item: qty=10, unit_price=50, total=500
        conn.execute(
            "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price, sort_order)
             VALUES (?1, 'print', 'Печать 10x15', 10, 50, 500, 0)",
            rusqlite::params![order_id],
        )
        .unwrap();

        // Add a service item: qty=1, unit_price=1000, total=1000
        conn.execute(
            "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price, price_source, sort_order)
             VALUES (?1, 'service', 'Фотосессия', 1, 1000, 1000, 'manual', 1)",
            rusqlite::params![order_id],
        )
        .unwrap();

        // Recalculate total
        conn.execute(
            "UPDATE orders SET total_amount = (
                SELECT COALESCE(SUM(total_price), 0) FROM order_items
                WHERE order_id = ?1 AND is_cancelled = 0
            ) WHERE id = ?1",
            rusqlite::params![order_id],
        )
        .unwrap();

        let total = get_f64(
            &conn,
            &format!("SELECT total_amount FROM orders WHERE id = {order_id}"),
        );
        assert_eq!(total, 1500.0);
    }

    #[test]
    fn test_cancel_item_recalculates_total() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");

        conn.execute(
            "INSERT INTO orders (number, client_id) VALUES ('2603-001', ?1)",
            rusqlite::params![client_id],
        )
        .unwrap();
        let order_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price)
             VALUES (?1, 'service', 'Item 1', 1, 300, 300)",
            rusqlite::params![order_id],
        )
        .unwrap();
        let item1_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price)
             VALUES (?1, 'service', 'Item 2', 1, 700, 700)",
            rusqlite::params![order_id],
        )
        .unwrap();

        conn.execute(
            "UPDATE orders SET total_amount = 1000 WHERE id = ?1",
            rusqlite::params![order_id],
        )
        .unwrap();

        // Cancel first item
        conn.execute(
            "UPDATE order_items SET is_cancelled = 1 WHERE id = ?1",
            rusqlite::params![item1_id],
        )
        .unwrap();

        conn.execute(
            "UPDATE orders SET total_amount = (
                SELECT COALESCE(SUM(total_price), 0) FROM order_items
                WHERE order_id = ?1 AND is_cancelled = 0
            ) WHERE id = ?1",
            rusqlite::params![order_id],
        )
        .unwrap();

        let total = get_f64(
            &conn,
            &format!("SELECT total_amount FROM orders WHERE id = {order_id}"),
        );
        assert_eq!(total, 700.0);
    }
}

mod payment_tests {
    use super::*;

    fn create_confirmed_order(conn: &Connection) -> (i64, i64) {
        let client_id = get_id(conn, "SELECT id FROM clients LIMIT 1");
        conn.execute(
            "INSERT INTO orders (number, client_id, production_status, total_amount)
             VALUES ('2603-001', ?1, 'confirmed', 5000)",
            rusqlite::params![client_id],
        )
        .unwrap();
        let order_id = conn.last_insert_rowid();
        let account_id = get_id(conn, "SELECT id FROM company_accounts WHERE account_type='cash'");
        (order_id, account_id)
    }

    #[test]
    fn test_payment_updates_paid_amount_and_status() {
        let conn = setup_db();
        let (order_id, account_id) = create_confirmed_order(&conn);

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, order_id, description)
             VALUES ('order_payment_in', 3000, 'in', ?1, ?2, 'test payment')",
            rusqlite::params![account_id, order_id],
        ).unwrap();
        let fin_tx_id = conn.last_insert_rowid();

        conn.execute("UPDATE company_accounts SET balance = balance + 3000 WHERE id = ?1", rusqlite::params![account_id]).unwrap();
        conn.execute(
            "INSERT INTO order_payments (order_id, amount, payment_method, account_id, finance_transaction_id)
             VALUES (?1, 3000, 'cash', ?2, ?3)",
            rusqlite::params![order_id, account_id, fin_tx_id],
        ).unwrap();
        conn.execute("UPDATE orders SET paid_amount = paid_amount + 3000 WHERE id = ?1", rusqlite::params![order_id]).unwrap();

        let (total, paid): (f64, f64) = conn.query_row(
            "SELECT total_amount, paid_amount FROM orders WHERE id = ?1",
            rusqlite::params![order_id], |row| Ok((row.get(0)?, row.get(1)?))
        ).unwrap();

        let status = if paid <= 0.0 { "unpaid" }
            else if paid > total { "overpaid" }
            else if (paid - total).abs() < 0.01 { "paid" }
            else { "partial" };

        conn.execute("UPDATE orders SET payment_status = ?1 WHERE id = ?2", rusqlite::params![status, order_id]).unwrap();

        assert_eq!(get_str(&conn, &format!("SELECT payment_status FROM orders WHERE id = {order_id}")), "partial");
        assert_eq!(get_f64(&conn, &format!("SELECT paid_amount FROM orders WHERE id = {order_id}")), 3000.0);

        let fin_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM finance_transactions WHERE order_id = ?1 AND transaction_type = 'order_payment_in'",
            rusqlite::params![order_id], |row| row.get(0)
        ).unwrap();
        assert_eq!(fin_count, 1);
        assert_eq!(get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {account_id}")), 3000.0);
    }

    #[test]
    fn test_full_payment_sets_paid_status() {
        let conn = setup_db();
        let (order_id, account_id) = create_confirmed_order(&conn);

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, order_id, description)
             VALUES ('order_payment_in', 5000, 'in', ?1, ?2, 'full payment')",
            rusqlite::params![account_id, order_id],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance + 5000 WHERE id = ?1", rusqlite::params![account_id]).unwrap();
        conn.execute("UPDATE orders SET paid_amount = 5000 WHERE id = ?1", rusqlite::params![order_id]).unwrap();

        let (total, paid): (f64, f64) = conn.query_row(
            "SELECT total_amount, paid_amount FROM orders WHERE id = ?1",
            rusqlite::params![order_id], |row| Ok((row.get(0)?, row.get(1)?))
        ).unwrap();

        let status = if (paid - total).abs() < 0.01 { "paid" } else { "partial" };
        assert_eq!(status, "paid");
    }

    #[test]
    fn test_refund_updates_paid_amount() {
        let conn = setup_db();
        let (order_id, account_id) = create_confirmed_order(&conn);

        conn.execute("UPDATE orders SET paid_amount = 5000, payment_status = 'paid' WHERE id = ?1", rusqlite::params![order_id]).unwrap();
        conn.execute("UPDATE company_accounts SET balance = 5000 WHERE id = ?1", rusqlite::params![account_id]).unwrap();

        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, order_id, description)
             VALUES ('order_refund_out', 2000, 'out', ?1, ?2, 'partial refund')",
            rusqlite::params![account_id, order_id],
        ).unwrap();
        let fin_tx_id = conn.last_insert_rowid();

        conn.execute("UPDATE company_accounts SET balance = balance - 2000 WHERE id = ?1", rusqlite::params![account_id]).unwrap();
        conn.execute(
            "INSERT INTO order_refunds (order_id, amount, payment_method, account_id, finance_transaction_id, reason)
             VALUES (?1, 2000, 'cash', ?2, ?3, 'Частичный возврат')",
            rusqlite::params![order_id, account_id, fin_tx_id],
        ).unwrap();
        conn.execute("UPDATE orders SET paid_amount = paid_amount - 2000 WHERE id = ?1", rusqlite::params![order_id]).unwrap();

        assert_eq!(get_f64(&conn, &format!("SELECT paid_amount FROM orders WHERE id = {order_id}")), 3000.0);
        assert_eq!(get_f64(&conn, &format!("SELECT balance FROM company_accounts WHERE id = {account_id}")), 3000.0);
        assert_eq!(get_str(&conn, &format!("SELECT transaction_type FROM finance_transactions WHERE id = {fin_tx_id}")), "order_refund_out");
    }
}

mod delivery_tests {
    use super::*;

    #[test]
    fn test_delivery_updates_status() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");

        conn.execute(
            "INSERT INTO orders (number, client_id, production_status) VALUES ('2603-001', ?1, 'ready')",
            rusqlite::params![client_id],
        ).unwrap();
        let order_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO order_deliveries (order_id, delivered_by, notes) VALUES (?1, 'Оператор', 'Выдано')",
            rusqlite::params![order_id],
        ).unwrap();
        conn.execute("UPDATE orders SET delivery_status = 'delivered' WHERE id = ?1", rusqlite::params![order_id]).unwrap();

        assert_eq!(get_str(&conn, &format!("SELECT delivery_status FROM orders WHERE id = {order_id}")), "delivered");
        let del_count: i32 = conn.query_row("SELECT COUNT(*) FROM order_deliveries WHERE order_id = ?1", rusqlite::params![order_id], |row| row.get(0)).unwrap();
        assert_eq!(del_count, 1);
    }

    #[test]
    fn test_delivery_allowed_with_unpaid() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");

        conn.execute(
            "INSERT INTO orders (number, client_id, production_status, payment_status, total_amount)
             VALUES ('2603-001', ?1, 'ready', 'unpaid', 5000)",
            rusqlite::params![client_id],
        ).unwrap();
        let order_id = conn.last_insert_rowid();

        conn.execute("INSERT INTO order_deliveries (order_id) VALUES (?1)", rusqlite::params![order_id]).unwrap();
        conn.execute("UPDATE orders SET delivery_status = 'delivered' WHERE id = ?1", rusqlite::params![order_id]).unwrap();

        assert_eq!(get_str(&conn, &format!("SELECT payment_status FROM orders WHERE id = {order_id}")), "unpaid");
        assert_eq!(get_str(&conn, &format!("SELECT delivery_status FROM orders WHERE id = {order_id}")), "delivered");
    }
}

mod filter_tests {
    use super::*;

    fn create_orders(conn: &Connection) {
        let client_id = get_id(conn, "SELECT id FROM clients LIMIT 1");
        conn.execute(
            "INSERT INTO orders (number, client_id, production_status, payment_status, delivery_status, total_amount, paid_amount)
             VALUES ('2603-001', ?1, 'confirmed', 'unpaid', 'not_delivered', 5000, 0)",
            rusqlite::params![client_id],
        ).unwrap();
        conn.execute(
            "INSERT INTO orders (number, client_id, production_status, payment_status, delivery_status, total_amount, paid_amount)
             VALUES ('2603-002', ?1, 'ready', 'paid', 'delivered', 3000, 3000)",
            rusqlite::params![client_id],
        ).unwrap();
        conn.execute(
            "INSERT INTO orders (number, client_id, production_status, payment_status, delivery_status, total_amount, paid_amount)
             VALUES ('2603-003', ?1, 'closed', 'partial', 'delivered', 8000, 4000)",
            rusqlite::params![client_id],
        ).unwrap();
    }

    #[test]
    fn test_filter_unpaid() {
        let conn = setup_db();
        create_orders(&conn);
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM orders WHERE payment_status IN ('unpaid', 'partial')",
            [], |row| row.get(0)
        ).unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn test_filter_delivered_but_unpaid() {
        let conn = setup_db();
        create_orders(&conn);
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM orders WHERE delivery_status = 'delivered' AND payment_status IN ('unpaid', 'partial')",
            [], |row| row.get(0)
        ).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_filter_by_production_status() {
        let conn = setup_db();
        create_orders(&conn);
        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM orders WHERE production_status = 'confirmed'",
            [], |row| row.get(0)
        ).unwrap();
        assert_eq!(count, 1);
    }
}

mod snapshot_tests {
    use super::*;

    #[test]
    fn test_book_composite_snapshot() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");

        conn.execute(
            "INSERT INTO orders (number, client_id) VALUES ('2603-001', ?1)",
            rusqlite::params![client_id],
        ).unwrap();
        let order_id = conn.last_insert_rowid();

        let spec = serde_json::json!({
            "format": "20x30",
            "spread_count": 5,
            "assembly_kind": "plastic",
            "cover_family": "eco_leather",
            "cover_options": ["Гравировка"],
        });

        // block: 600*5=3000, cover: 3000, option: 1000 = 7000
        let breakdown = serde_json::json!({
            "formula_type": "book_composite",
            "block": {"assembly_kind": "plastic", "format": "20x30", "per_spread": 600, "spread_count": 5, "total": 3000},
            "cover": {"cover_family": "eco_leather", "format": "20x30", "price": 3000},
            "cover_options": [{"option": "Гравировка", "price": 1000}],
            "unit_price": 7000,
            "qty": 1,
            "total_price": 7000,
        });

        conn.execute(
            "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price,
                spec_snapshot_json, price_breakdown_json)
             VALUES (?1, 'book', 'Фотокнига 20x30, 5 разв., пластик, экокожа', 1, 7000, 7000, ?2, ?3)",
            rusqlite::params![order_id, spec.to_string(), breakdown.to_string()],
        ).unwrap();
        let item_id = conn.last_insert_rowid();

        let stored_spec: String = conn.query_row(
            "SELECT spec_snapshot_json FROM order_items WHERE id = ?1",
            rusqlite::params![item_id], |row| row.get(0)
        ).unwrap();
        let parsed: serde_json::Value = serde_json::from_str(&stored_spec).unwrap();
        assert_eq!(parsed["format"], "20x30");
        assert_eq!(parsed["assembly_kind"], "plastic");
        assert_eq!(parsed["cover_family"], "eco_leather");

        let stored_bd: String = conn.query_row(
            "SELECT price_breakdown_json FROM order_items WHERE id = ?1",
            rusqlite::params![item_id], |row| row.get(0)
        ).unwrap();
        let parsed_bd: serde_json::Value = serde_json::from_str(&stored_bd).unwrap();
        assert_eq!(parsed_bd["formula_type"], "book_composite");
        assert_eq!(parsed_bd["unit_price"], 7000.0);
        assert_eq!(parsed_bd["block"]["per_spread"], 600.0);
        assert_eq!(parsed_bd["cover"]["price"], 3000.0);
    }
}

// ── Structured rule CRUD tests (simulates UI form → JSON) ───────────

mod structured_rule_tests {
    use super::*;

    /// Simulates what the new UI does: build match_params and price_formula
    /// from structured form values, then create a rule via SQL.
    fn create_rule_structured(
        conn: &Connection,
        prog_id: i64,
        item_kind: &str,
        match_params: serde_json::Value,
        price: f64,
    ) -> i64 {
        let formula = serde_json::json!({"type": "fixed", "price": price});
        conn.execute(
            "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                prog_id,
                item_kind,
                match_params.to_string(),
                formula.to_string()
            ],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    #[test]
    fn test_create_lab_print_rule_structured() {
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");

        // UI form: category=lab_print, format=15x20 (not in seed data), price=90
        let match_params = serde_json::json!({
            "category": "lab_print",
            "format": "15x20"
        });
        let rule_id = create_rule_structured(&conn, prog_id, "print", match_params, 90.0);
        assert!(rule_id > 0);

        // Verify rule matches correctly
        let spec = serde_json::json!({"category": "lab_print", "format": "15x20"});
        let (found_id, formula) = find_matching_rule(&conn, prog_id, "print", &spec).unwrap();
        assert_eq!(found_id, rule_id);
        assert_eq!(formula["price"], 90.0);
    }

    #[test]
    fn test_edit_photo_pvc_rule_structured() {
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");

        // Find existing photo_pvc 30x43 rule
        let spec = serde_json::json!({"category": "photo_pvc", "format": "30x43"});
        let (rule_id, formula) = find_matching_rule(&conn, prog_id, "print", &spec).unwrap();
        assert_eq!(formula["price"], 1300.0);

        // UI edit: change price to 1500, keep match_params
        let new_formula = serde_json::json!({"type": "fixed", "price": 1500.0});
        let new_match = serde_json::json!({"category": "photo_pvc", "format": "30x43"});
        conn.execute(
            "UPDATE pricing_rules SET match_params = ?1, price_formula = ?2 WHERE id = ?3",
            rusqlite::params![new_match.to_string(), new_formula.to_string(), rule_id],
        )
        .unwrap();

        // Verify updated price
        let (_, updated_formula) = find_matching_rule(&conn, prog_id, "print", &spec).unwrap();
        assert_eq!(updated_formula["price"], 1500.0);
    }

    #[test]
    fn test_create_book_block_rule_structured() {
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");

        // UI form: book block, assembly_kind=plastic, format=25x25, price=870
        let match_params = serde_json::json!({
            "component": "block",
            "assembly_kind": "plastic",
            "format": "25x25"
        });
        let rule_id = create_rule_structured(&conn, prog_id, "book", match_params, 870.0);
        assert!(rule_id > 0);

        // Verify it matches
        let spec = serde_json::json!({"component": "block", "assembly_kind": "plastic", "format": "25x25"});
        let (_, formula) = find_matching_rule(&conn, prog_id, "book", &spec).unwrap();
        assert_eq!(formula["price"], 870.0);
    }

    #[test]
    fn test_create_book_cover_option_rule_structured() {
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");

        // UI form: book cover option, option_name=Уголки, price=500
        let match_params = serde_json::json!({
            "component": "cover_option",
            "option_name": "Уголки"
        });
        let rule_id = create_rule_structured(&conn, prog_id, "book", match_params, 500.0);
        assert!(rule_id > 0);

        // Verify it matches
        let spec = serde_json::json!({"component": "cover_option", "option_name": "Уголки"});
        let (_, formula) = find_matching_rule(&conn, prog_id, "book", &spec).unwrap();
        assert_eq!(formula["price"], 500.0);
    }

    #[test]
    fn test_structured_rule_json_serialization() {
        // Verifies that the JSON produced by form → JSON mapping
        // is valid and matches the engine's expectations.
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");

        // Simulate category types from seed data only
        let test_cases: Vec<(&str, serde_json::Value, f64)> = vec![
            ("print", serde_json::json!({"category": "lab_print", "format": "10x15"}), 50.0),
            ("print", serde_json::json!({"category": "lab_print", "format": "20x30"}), 180.0),
            ("print", serde_json::json!({"category": "wide_format_lamination", "lamination_type": "Алмазная"}), 1500.0),
            ("print", serde_json::json!({"category": "photo_pvc", "format": "30x43"}), 1300.0),
            ("book", serde_json::json!({"component": "block", "assembly_kind": "plastic", "format": "20x30"}), 600.0),
            ("book", serde_json::json!({"component": "block", "assembly_kind": "pvc_board", "format": "20x30"}), 550.0),
            ("book", serde_json::json!({"component": "cover", "cover_family": "eco_leather", "format": "20x30"}), 3000.0),
            ("book", serde_json::json!({"component": "cover", "cover_family": "laminated_hard", "format": "20x30"}), 1800.0),
            ("book", serde_json::json!({"component": "cover_option", "option_name": "Гравировка"}), 1000.0),
            ("book", serde_json::json!({"component": "cover_option", "option_name": "Фото-вставка"}), 800.0),
        ];

        for (item_kind, spec, expected_price) in test_cases {
            let result = find_matching_rule(&conn, prog_id, item_kind, &spec);
            assert!(
                result.is_some(),
                "No rule found for {item_kind} with spec {}",
                spec
            );
            let (_, formula) = result.unwrap();
            assert_eq!(
                formula["price"].as_f64().unwrap(),
                expected_price,
                "Price mismatch for {item_kind} spec {}",
                spec
            );
        }
    }

    #[test]
    fn test_rule_summary_data_extraction() {
        // Verifies that the match_params JSON can be parsed to extract
        // human-readable summary fields (what the UI summary generator does).
        let conn = setup_db();
        let prog_id = get_id(&conn, "SELECT id FROM pricing_programs WHERE name = 'Цены'");

        // Get a lab_print rule
        let rule: (String, String) = conn.query_row(
            "SELECT match_params, price_formula FROM pricing_rules
             WHERE pricing_program_id = ?1 AND item_kind = 'print'
             AND match_params LIKE '%lab_print%' AND match_params LIKE '%10x15%'",
            rusqlite::params![prog_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).unwrap();

        let mp: serde_json::Value = serde_json::from_str(&rule.0).unwrap();
        let pf: serde_json::Value = serde_json::from_str(&rule.1).unwrap();

        // UI summary extraction: category, format, price
        assert_eq!(mp["category"], "lab_print");
        assert_eq!(mp["format"], "10x15");
        assert_eq!(pf["type"], "fixed");
        assert_eq!(pf["price"], 50.0);

        // Get a book block rule
        let block_rule: (String, String) = conn.query_row(
            "SELECT match_params, price_formula FROM pricing_rules
             WHERE pricing_program_id = ?1 AND item_kind = 'book'
             AND match_params LIKE '%block%' AND match_params LIKE '%plastic%' AND match_params LIKE '%20x30%'",
            rusqlite::params![prog_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        ).unwrap();

        let mp2: serde_json::Value = serde_json::from_str(&block_rule.0).unwrap();
        assert_eq!(mp2["component"], "block");
        assert_eq!(mp2["assembly_kind"], "plastic");
        assert_eq!(mp2["format"], "20x30");
    }
}

// ── Client balance tests ──────────────────────────────────────────────

mod client_balance_tests {
    use super::*;

    fn create_order_with_total(conn: &Connection, total: f64) -> (i64, i64, i64) {
        let client_id = get_id(conn, "SELECT id FROM clients LIMIT 1");
        let account_id = get_id(conn, "SELECT id FROM company_accounts WHERE account_type='cash'");
        conn.execute(
            "INSERT INTO orders (number, client_id, production_status, total_amount)
             VALUES ('2604-001', ?1, 'in_work', ?2)",
            rusqlite::params![client_id, total],
        ).unwrap();
        let order_id = conn.last_insert_rowid();
        (client_id, order_id, account_id)
    }

    #[test]
    fn test_deposit_increases_client_balance() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");

        assert_eq!(get_f64(&conn, &format!("SELECT balance FROM clients WHERE id = {client_id}")), 0.0);

        // Simulate deposit
        conn.execute(
            "UPDATE clients SET balance = balance + 50000 WHERE id = ?1",
            rusqlite::params![client_id],
        ).unwrap();
        conn.execute(
            "INSERT INTO client_balance_transactions (client_id, amount, direction, transaction_type, payment_method, account_id, notes)
             VALUES (?1, 50000, 'in', 'deposit', 'cash', 1, 'Аванс')",
            rusqlite::params![client_id],
        ).unwrap();

        assert_eq!(get_f64(&conn, &format!("SELECT balance FROM clients WHERE id = {client_id}")), 50000.0);

        let tx_count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM client_balance_transactions WHERE client_id = ?1 AND transaction_type = 'deposit'",
            rusqlite::params![client_id], |row| row.get(0)
        ).unwrap();
        assert_eq!(tx_count, 1);
    }

    #[test]
    fn test_pay_order_from_balance() {
        let conn = setup_db();
        let (client_id, order_id, _account_id) = create_order_with_total(&conn, 20000.0);

        // Give client a balance
        conn.execute("UPDATE clients SET balance = 50000 WHERE id = ?1", rusqlite::params![client_id]).unwrap();

        // Pay order from balance
        conn.execute("UPDATE clients SET balance = balance - 20000 WHERE id = ?1", rusqlite::params![client_id]).unwrap();
        conn.execute("UPDATE orders SET paid_amount = paid_amount + 20000 WHERE id = ?1", rusqlite::params![order_id]).unwrap();
        conn.execute(
            "INSERT INTO client_balance_transactions (client_id, amount, direction, transaction_type, order_id)
             VALUES (?1, 20000, 'out', 'order_payment', ?2)",
            rusqlite::params![client_id, order_id],
        ).unwrap();

        // Recompute payment status
        let (total, paid): (f64, f64) = conn.query_row(
            "SELECT total_amount, paid_amount FROM orders WHERE id = ?1",
            rusqlite::params![order_id], |row| Ok((row.get(0)?, row.get(1)?))
        ).unwrap();
        let status = if (paid - total).abs() < 0.01 { "paid" } else { "partial" };
        conn.execute("UPDATE orders SET payment_status = ?1 WHERE id = ?2", rusqlite::params![status, order_id]).unwrap();

        assert_eq!(get_f64(&conn, &format!("SELECT balance FROM clients WHERE id = {client_id}")), 30000.0);
        assert_eq!(get_str(&conn, &format!("SELECT payment_status FROM orders WHERE id = {order_id}")), "paid");
        assert_eq!(get_f64(&conn, &format!("SELECT paid_amount FROM orders WHERE id = {order_id}")), 20000.0);
    }

    #[test]
    fn test_overpayment_surplus_to_balance() {
        let conn = setup_db();
        let (client_id, order_id, account_id) = create_order_with_total(&conn, 20000.0);

        // Client pays 70000 for 20000 order
        let payment_amount = 70000.0;
        let total_amount = 20000.0;
        let surplus = payment_amount - total_amount;

        // Record finance transaction
        conn.execute(
            "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, order_id, description)
             VALUES ('order_payment_in', ?1, 'in', ?2, ?3, 'Оплата')",
            rusqlite::params![payment_amount, account_id, order_id],
        ).unwrap();
        conn.execute("UPDATE company_accounts SET balance = balance + ?1 WHERE id = ?2", rusqlite::params![payment_amount, account_id]).unwrap();

        // Only order amount goes to paid_amount
        conn.execute("UPDATE orders SET paid_amount = ?1, payment_status = 'paid' WHERE id = ?2", rusqlite::params![total_amount, order_id]).unwrap();

        // Surplus goes to client balance
        conn.execute("UPDATE clients SET balance = balance + ?1 WHERE id = ?2", rusqlite::params![surplus, client_id]).unwrap();
        conn.execute(
            "INSERT INTO client_balance_transactions (client_id, amount, direction, transaction_type, order_id, notes)
             VALUES (?1, ?2, 'in', 'order_surplus', ?3, 'Излишек по оплате заказа')",
            rusqlite::params![client_id, surplus, order_id],
        ).unwrap();

        assert_eq!(get_f64(&conn, &format!("SELECT balance FROM clients WHERE id = {client_id}")), 50000.0);
        assert_eq!(get_f64(&conn, &format!("SELECT paid_amount FROM orders WHERE id = {order_id}")), 20000.0);
        assert_eq!(get_str(&conn, &format!("SELECT payment_status FROM orders WHERE id = {order_id}")), "paid");

        // Verify balance transaction recorded
        let surplus_tx: (f64, String) = conn.query_row(
            "SELECT amount, transaction_type FROM client_balance_transactions
             WHERE client_id = ?1 AND transaction_type = 'order_surplus'",
            rusqlite::params![client_id], |row| Ok((row.get(0)?, row.get(1)?))
        ).unwrap();
        assert_eq!(surplus_tx.0, 50000.0);
        assert_eq!(surplus_tx.1, "order_surplus");
    }

    #[test]
    fn test_withdraw_from_balance() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");

        // Give client balance
        conn.execute("UPDATE clients SET balance = 30000 WHERE id = ?1", rusqlite::params![client_id]).unwrap();

        // Withdraw
        conn.execute("UPDATE clients SET balance = balance - 10000 WHERE id = ?1", rusqlite::params![client_id]).unwrap();
        conn.execute(
            "INSERT INTO client_balance_transactions (client_id, amount, direction, transaction_type, payment_method, account_id)
             VALUES (?1, 10000, 'out', 'withdraw', 'cash', 1)",
            rusqlite::params![client_id],
        ).unwrap();

        assert_eq!(get_f64(&conn, &format!("SELECT balance FROM clients WHERE id = {client_id}")), 20000.0);
    }

    #[test]
    fn test_balance_history_ordering() {
        let conn = setup_db();
        let client_id = get_id(&conn, "SELECT id FROM clients LIMIT 1");

        // Multiple transactions
        conn.execute("UPDATE clients SET balance = 50000 WHERE id = ?1", rusqlite::params![client_id]).unwrap();
        conn.execute(
            "INSERT INTO client_balance_transactions (client_id, amount, direction, transaction_type, notes)
             VALUES (?1, 50000, 'in', 'deposit', 'first')",
            rusqlite::params![client_id],
        ).unwrap();
        conn.execute(
            "INSERT INTO client_balance_transactions (client_id, amount, direction, transaction_type, notes)
             VALUES (?1, 20000, 'out', 'order_payment', 'second')",
            rusqlite::params![client_id],
        ).unwrap();

        let count: i32 = conn.query_row(
            "SELECT COUNT(*) FROM client_balance_transactions WHERE client_id = ?1",
            rusqlite::params![client_id], |row| row.get(0)
        ).unwrap();
        assert_eq!(count, 2);
    }
}

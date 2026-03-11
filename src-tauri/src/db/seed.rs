use rusqlite::Connection;

/// Seed essential data required for the app to function.
/// Safe to call multiple times — only inserts if tables are empty.
pub fn run(conn: &Connection) -> Result<(), rusqlite::Error> {
    seed_partners(conn)?;
    seed_company_accounts(conn)?;
    seed_app_settings(conn)?;
    seed_catalogs(conn)?;
    seed_pricing(conn)?;
    seed_finance_categories(conn)?;
    Ok(())
}

/// Seed demo data (clients, orders, transactions) — called from UI.
pub fn seed_demo(conn: &Connection) -> Result<String, rusqlite::Error> {
    let client_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM clients", [], |r| r.get(0),
    )?;
    if client_count > 0 {
        return Ok("Демо-данные уже существуют".to_string());
    }

    seed_demo_clients(conn)?;
    seed_demo_orders(conn)?;
    seed_demo_finance(conn)?;

    Ok("Демо-данные загружены: клиенты, заказы, транзакции, долги, партнёрские расчёты".to_string())
}

// ── Required seeds ──────────────────────────────────────────────────

fn seed_partners(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM partners", [], |r| r.get(0))?;
    if count > 0 { return Ok(()); }
    log::info!("Seeding partners...");
    conn.execute("INSERT INTO partners (name, profit_share) VALUES ('Партнёр 1', 0.5)", [])?;
    conn.execute("INSERT INTO partners (name, profit_share) VALUES ('Партнёр 2', 0.5)", [])?;
    Ok(())
}

fn seed_company_accounts(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM company_accounts", [], |r| r.get(0))?;
    if count > 0 { return Ok(()); }
    log::info!("Seeding company accounts...");
    conn.execute("INSERT INTO company_accounts (name, account_type) VALUES ('Касса', 'cash')", [])?;
    conn.execute("INSERT INTO company_accounts (name, account_type) VALUES ('Карта', 'card')", [])?;
    conn.execute("INSERT INTO company_accounts (name, account_type) VALUES ('Расчётный счёт', 'bank')", [])?;
    Ok(())
}

fn seed_app_settings(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM app_settings", [], |r| r.get(0))?;
    if count > 0 { return Ok(()); }
    log::info!("Seeding app settings...");
    conn.execute("INSERT INTO app_settings (key, value) VALUES ('company_name', 'Фотостудия')", [])?;
    Ok(())
}

fn seed_catalogs(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM book_formats", [], |r| r.get(0))?;
    if count > 0 { return Ok(()); }
    log::info!("Seeding product catalogs...");

    // Book formats — only those used in pricing rules
    let book_fmts = [
        "15x15", "15x20", "20x20", "20x25", "20x27", "20x30",
        "21x30", "25x25", "30x30", "30x40", "30x43",
    ];
    for (i, name) in book_fmts.iter().enumerate() {
        conn.execute(
            "INSERT INTO book_formats (name, sort_order) VALUES (?1, ?2)",
            rusqlite::params![name, i],
        )?;
    }

    // Print formats — only those used in pricing rules
    let print_fmts = [
        "7x10", "10x15", "15x20", "15x21", "15x22", "15x23",
        "20x30", "20x33", "20x40", "20x60",
        "30x40", "30x41", "30x42", "30x43", "30x44", "30x45",
        "30x60", "30x80", "30x90",
        "40x60", "50x70", "60x90", "100x100", "100x150",
    ];
    for (i, name) in print_fmts.iter().enumerate() {
        conn.execute(
            "INSERT INTO print_formats (name, sort_order) VALUES (?1, ?2)",
            rusqlite::params![name, i],
        )?;
    }

    // Other catalogs (cover_types, cover_materials, lamination_types,
    // materials, extra_option_types) intentionally left empty —
    // they are not part of the pricing program.
    // Users can add entries as needed through the Справочники UI.

    Ok(())
}

fn seed_pricing(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Check if pricing program already exists
    let has_real: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM pricing_programs WHERE name = 'Цены'",
        [], |r| r.get(0),
    ).unwrap_or(false);
    if has_real { return Ok(()); }

    log::info!("Seeding pricing program: Цены...");

    // Deactivate old demo programs if they exist
    conn.execute(
        "UPDATE pricing_programs SET is_active = 0 WHERE name IN ('Стандарт', 'Оптовый', 'Прайс для профиков')",
        [],
    )?;

    conn.execute(
        "INSERT INTO pricing_programs (name) VALUES ('Цены')",
        [],
    )?;
    let pid = conn.last_insert_rowid();

    // Helper closure for inserting rules
    let ins = |kind: &str, mp: &str, pf: &str| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![pid, kind, mp, pf],
        )?;
        Ok(())
    };

    // ── 5.1 Lab print (per piece) ──────────────────────────────────
    let lab_prints = [
        ("10x15", 50), ("15x20", 90), ("15x21", 90), ("15x22", 100), ("15x23", 100),
        ("20x30", 180), ("20x33", 190), ("30x40", 350), ("30x41", 350), ("30x42", 360),
        ("30x43", 360), ("30x60", 550), ("30x90", 800),
    ];
    for (fmt, price) in lab_prints {
        ins("print",
            &format!("{{\"category\":\"lab_print\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.2 Wide format print (per running meter) ──────────────────
    let wide_prints = [
        ("Фотобумага матовая 106 см, самоклейка", 6500),
        ("Печать на холсте, ширина 60 см", 4800),
        ("Печать на холсте, ширина 90 см", 7300),
    ];
    for (material, price) in wide_prints {
        ins("print",
            &format!("{{\"category\":\"wide_format_print\",\"material\":\"{material}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.3 Wide format lamination (per sq meter) ──────────────────
    let wide_lam = [
        ("Матовая", 800), ("Глянцевая", 800), ("Лён", 1000), ("Алмазная", 1500),
    ];
    for (ltype, price) in wide_lam {
        ins("print",
            &format!("{{\"category\":\"wide_format_lamination\",\"lamination_type\":\"{ltype}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.4 Photo lamination (per piece) ───────────────────────────
    let photo_lam = [
        ("10x15", 150), ("15x20", 150), ("20x30", 200), ("20x40", 250),
        ("30x40", 350), ("20x60", 350), ("30x60", 600), ("30x80", 800),
    ];
    for (fmt, price) in photo_lam {
        ins("print",
            &format!("{{\"category\":\"photo_lamination\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.5 Photo magnet (per piece) ───────────────────────────────
    let magnets = [
        ("7x10", 250), ("10x15", 300), ("15x20", 500), ("15x22", 530),
        ("20x30", 900), ("30x40", 1700),
    ];
    for (fmt, price) in magnets {
        ins("print",
            &format!("{{\"category\":\"photo_magnet\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.6 Photo PVC (per piece) ──────────────────────────────────
    let pvc = [
        ("10x15", 500), ("15x20", 500), ("20x30", 600), ("30x40", 1200),
        ("30x42", 1200), ("30x43", 1300), ("30x44", 1300), ("30x45", 1300),
        ("50x70", 5000), ("60x90", 6500), ("100x100", 12000),
    ];
    for (fmt, price) in pvc {
        ins("print",
            &format!("{{\"category\":\"photo_pvc\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.7 DSP picture (per piece) ────────────────────────────────
    ins("print",
        "{\"category\":\"dsp_picture\",\"format\":\"30x42\"}",
        "{\"type\":\"fixed\",\"price\":5000}")?;

    // ── 5.8 Book block — plastic assembly ──────────────────────────
    let plastic = [
        ("15x15", 400), ("15x20", 400), ("20x20", 550), ("20x30", 600),
        ("21x30", 650), ("25x25", 870), ("30x30", 870), ("30x40", 1070),
        ("30x43", 1100),
    ];
    for (fmt, price) in plastic {
        ins("book",
            &format!("{{\"component\":\"block\",\"assembly_kind\":\"plastic\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.9 Book block — PVC board assembly ────────────────────────
    let pvc_board = [
        ("15x15", 350), ("15x20", 350), ("20x20", 450), ("20x30", 550),
        ("21x30", 600), ("25x25", 790), ("30x30", 790), ("30x40", 900),
        ("30x43", 950),
    ];
    for (fmt, price) in pvc_board {
        ins("book",
            &format!("{{\"component\":\"block\",\"assembly_kind\":\"pvc_board\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.10 Book cover — laminated hard ───────────────────────────
    let lam_hard = [
        ("15x15", 1000), ("15x20", 1000), ("20x20", 1400), ("20x25", 1500),
        ("20x27", 1800), ("20x30", 1800), ("25x25", 3000), ("30x30", 3000),
        ("30x40", 4500), ("30x43", 4500),
    ];
    for (fmt, price) in lam_hard {
        ins("book",
            &format!("{{\"component\":\"cover\",\"cover_family\":\"laminated_hard\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.11 Book cover — eco leather ──────────────────────────────
    let eco = [
        ("15x15", 2800), ("15x20", 2800), ("20x20", 2800), ("20x27", 3000),
        ("20x30", 3000), ("25x25", 4500), ("30x30", 4500), ("30x40", 5500),
        ("30x43", 5500),
    ];
    for (fmt, price) in eco {
        ins("book",
            &format!("{{\"component\":\"cover\",\"cover_family\":\"eco_leather\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.12 Book cover options (eco leather) ──────────────────────
    ins("book",
        "{\"component\":\"cover_option\",\"option_name\":\"Гравировка\"}",
        "{\"type\":\"fixed\",\"price\":1000}")?;
    ins("book",
        "{\"component\":\"cover_option\",\"option_name\":\"Фото-вставка\"}",
        "{\"type\":\"fixed\",\"price\":800}")?;

    // ── 5.13 Canvas stretched (per piece) ──────────────────────────
    let canvas = [
        ("15x20", 3000), ("20x30", 3000), ("30x40", 4000), ("40x60", 5000),
        ("50x70", 6500), ("60x90", 9500), ("100x100", 18000), ("100x150", 27000),
    ];
    for (fmt, price) in canvas {
        ins("print",
            &format!("{{\"category\":\"canvas_stretched\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── 5.14 Calendar double sided (per piece) ─────────────────────
    let calendars = [("15x20", 2000), ("20x30", 4000)];
    for (fmt, price) in calendars {
        ins("print",
            &format!("{{\"category\":\"calendar_double_sided\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    Ok(())
}

fn seed_finance_categories(conn: &Connection) -> Result<(), rusqlite::Error> {
    let count: i32 = conn.query_row("SELECT COUNT(*) FROM finance_categories", [], |r| r.get(0))?;
    if count > 0 { return Ok(()); }
    log::info!("Seeding finance categories...");

    // System income categories
    conn.execute(
        "INSERT INTO finance_categories (name, category_type, is_system, sort_order) VALUES ('Оплата заказов', 'income', 1, 0)", [],
    )?;
    conn.execute(
        "INSERT INTO finance_categories (name, category_type, is_system, sort_order) VALUES ('Прочий доход', 'income', 0, 1)", [],
    )?;

    // Expense categories
    let expenses = [
        ("Материалы", true),
        ("Аренда", false),
        ("Доставка", false),
        ("Оборудование", false),
        ("Прочие расходы", false),
    ];
    for (i, (name, is_system)) in expenses.iter().enumerate() {
        conn.execute(
            "INSERT INTO finance_categories (name, category_type, is_system, sort_order) VALUES (?1, 'expense', ?2, ?3)",
            rusqlite::params![name, *is_system as i32, i],
        )?;
    }

    Ok(())
}

// ── Demo seeds (called from UI) ─────────────────────────────────────

fn seed_demo_clients(conn: &Connection) -> Result<(), rusqlite::Error> {
    log::info!("Seeding demo clients...");

    let clients = [
        ("Иванова Мария", "+7 900 111-22-33", "maria@example.com"),
        ("Петров Сергей", "+7 900 444-55-66", ""),
        ("Школа №42", "+7 495 123-45-67", "school42@example.com"),
        ("Детский сад \"Солнышко\"", "+7 495 765-43-21", ""),
        ("Козлова Анна", "+7 916 888-99-00", "anna.k@example.com"),
    ];

    // Get the standard pricing program id
    let pricing_id: Option<i64> = conn.query_row(
        "SELECT id FROM pricing_programs WHERE name = 'Цены' AND is_active = 1 LIMIT 1",
        [], |r| r.get(0),
    ).ok();

    for (name, phone, email) in &clients {
        conn.execute(
            "INSERT INTO clients (name, phone, email, default_pricing_program_id)
             VALUES (?1, ?2, NULLIF(?3, ''), ?4)",
            rusqlite::params![name, phone, email, pricing_id],
        )?;
    }

    Ok(())
}

fn seed_demo_orders(conn: &Connection) -> Result<(), rusqlite::Error> {
    log::info!("Seeding demo orders...");

    // ── Order 1: Школа №42 — confirmed, partial payment ──────────────
    let client_id: i64 = conn.query_row(
        "SELECT id FROM clients WHERE name LIKE '%Школа%' LIMIT 1",
        [], |r| r.get(0),
    )?;

    let pricing_id: Option<i64> = conn.query_row(
        "SELECT id FROM pricing_programs WHERE name = 'Цены' AND is_active = 1 LIMIT 1",
        [], |r| r.get(0),
    ).ok();

    // Book: 20x30 plastic, 15 spreads, laminated_hard cover
    // block: 600/spread * 15 = 9000, cover: 1800, total per book: 10800
    // + print 10x15 * 10 = 500, + service 800 = total 12100
    conn.execute(
        "INSERT INTO orders (number, client_id, pricing_program_id, production_status, payment_status, total_amount, paid_amount, notes, due_date)
         VALUES ('2603-001', ?1, ?2, 'confirmed', 'partial', 12100, 5000, 'Выпускной альбом 4А класс', '2026-04-15')",
        rusqlite::params![client_id, pricing_id],
    )?;
    let order1_id = conn.last_insert_rowid();

    // Book item: 20x30 plastic + laminated_hard, 15 spreads = 600*15 + 1800 = 10800
    conn.execute(
        "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price, spec_snapshot_json, price_breakdown_json, sort_order)
         VALUES (?1, 'book', 'Фотокнига 20x30, пластик, 15 разворотов, ламин. обложка', 1, 10800, 10800,
            '{\"format\":\"20x30\",\"spread_count\":15,\"assembly_kind\":\"plastic\",\"cover_family\":\"laminated_hard\"}',
            '{\"formula_type\":\"book_composite\",\"block\":{\"per_spread\":600,\"spread_count\":15,\"total\":9000},\"cover\":{\"price\":1800},\"unit_price\":10800}',
            0)",
        rusqlite::params![order1_id],
    )?;
    let book_item_id = conn.last_insert_rowid();

    let fmt_id: i64 = conn.query_row("SELECT id FROM book_formats WHERE name='20x30'", [], |r| r.get(0))?;

    conn.execute(
        "INSERT INTO order_item_books (order_item_id, book_format_id, spread_count, assembly_kind, cover_family)
         VALUES (?1, ?2, 15, 'plastic', 'laminated_hard')",
        rusqlite::params![book_item_id, fmt_id],
    )?;

    // Print item
    conn.execute(
        "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price, spec_snapshot_json, price_breakdown_json, sort_order)
         VALUES (?1, 'print', 'Фото 10x15', 10, 50, 500,
            '{\"category\":\"lab_print\",\"format\":\"10x15\"}',
            '{\"rule_id\":1,\"formula_type\":\"fixed\",\"unit_price\":50,\"qty\":10,\"total_price\":500}',
            1)",
        rusqlite::params![order1_id],
    )?;
    let print_item_id = conn.last_insert_rowid();

    let pfmt_id: i64 = conn.query_row("SELECT id FROM print_formats WHERE name='10x15'", [], |r| r.get(0))?;
    conn.execute(
        "INSERT INTO order_item_prints (order_item_id, print_format_id)
         VALUES (?1, ?2)",
        rusqlite::params![print_item_id, pfmt_id],
    )?;

    // Service item
    conn.execute(
        "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price, price_source, spec_snapshot_json, price_breakdown_json, sort_order)
         VALUES (?1, 'service', 'Ретушь фотографий', 1, 800, 800, 'manual',
            '{\"service_name\":\"Ретушь фотографий\"}',
            '{\"source\":\"manual\",\"unit_price\":800,\"qty\":1,\"total_price\":800}',
            2)",
        rusqlite::params![order1_id],
    )?;

    // Partial payment: 5000 из 12100
    let cash_account_id: i64 = conn.query_row(
        "SELECT id FROM company_accounts WHERE account_type='cash'", [], |r| r.get(0),
    )?;

    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, order_id, description, transaction_date)
         VALUES ('order_payment_in', 5000, 'in', ?1, ?2, 'Предоплата за заказ 2603-001', date('now'))",
        rusqlite::params![cash_account_id, order1_id],
    )?;
    let fin_tx_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO order_payments (order_id, amount, payment_method, account_id, finance_transaction_id, notes)
         VALUES (?1, 5000, 'cash', ?2, ?3, 'Предоплата')",
        rusqlite::params![order1_id, cash_account_id, fin_tx_id],
    )?;
    conn.execute(
        "UPDATE company_accounts SET balance = balance + 5000 WHERE id = ?1",
        rusqlite::params![cash_account_id],
    )?;

    // ── Order 2: Иванова Мария — ready, fully paid, delivered ─────────
    let maria_id: i64 = conn.query_row(
        "SELECT id FROM clients WHERE name LIKE '%Иванова%' LIMIT 1",
        [], |r| r.get(0),
    )?;

    // Book: 25x25 plastic, 20 spreads, eco_leather cover
    // block: 870/spread * 20 = 17400, cover: 4500, total: 21900
    conn.execute(
        "INSERT INTO orders (number, client_id, pricing_program_id, production_status, payment_status, delivery_status, total_amount, paid_amount, notes)
         VALUES ('2603-002', ?1, ?2, 'ready', 'paid', 'delivered', 21900, 21900, 'Семейная фотосессия')",
        rusqlite::params![maria_id, pricing_id],
    )?;
    let order2_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price, spec_snapshot_json, price_breakdown_json, sort_order)
         VALUES (?1, 'book', 'Фотокнига 25x25, пластик, 20 разворотов, экокожа', 1, 21900, 21900,
            '{\"format\":\"25x25\",\"spread_count\":20,\"assembly_kind\":\"plastic\",\"cover_family\":\"eco_leather\"}',
            '{\"formula_type\":\"book_composite\",\"block\":{\"per_spread\":870,\"spread_count\":20,\"total\":17400},\"cover\":{\"price\":4500},\"unit_price\":21900}',
            0)",
        rusqlite::params![order2_id],
    )?;

    let card_id: i64 = conn.query_row(
        "SELECT id FROM company_accounts WHERE account_type='card'", [], |r| r.get(0),
    )?;

    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, order_id, description, transaction_date)
         VALUES ('order_payment_in', 21900, 'in', ?1, ?2, 'Полная оплата заказа 2603-002', date('now'))",
        rusqlite::params![card_id, order2_id],
    )?;
    let fin_tx2 = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO order_payments (order_id, amount, payment_method, account_id, finance_transaction_id, notes)
         VALUES (?1, 21900, 'card', ?2, ?3, 'Полная оплата')",
        rusqlite::params![order2_id, card_id, fin_tx2],
    )?;
    conn.execute("UPDATE company_accounts SET balance = balance + 21900 WHERE id = ?1", rusqlite::params![card_id])?;

    // Delivery for order 2
    conn.execute(
        "INSERT INTO order_deliveries (order_id, delivered_by, notes)
         VALUES (?1, 'Администратор', 'Выдан в студии')",
        rusqlite::params![order2_id],
    )?;

    // ── Order 3: Козлова Анна — draft ────────────────────────────────
    let anna_id: i64 = conn.query_row(
        "SELECT id FROM clients WHERE name LIKE '%Козлова%' LIMIT 1",
        [], |r| r.get(0),
    )?;

    conn.execute(
        "INSERT INTO orders (number, client_id, pricing_program_id, production_status, payment_status, total_amount, paid_amount, notes)
         VALUES ('2603-003', ?1, ?2, 'draft', 'unpaid', 0, 0, 'Ждём выбор фотографий')",
        rusqlite::params![anna_id, pricing_id],
    )?;

    Ok(())
}

fn seed_demo_finance(conn: &Connection) -> Result<(), rusqlite::Error> {
    log::info!("Seeding demo finance scenario...");

    let cash_id: i64 = conn.query_row(
        "SELECT id FROM company_accounts WHERE account_type='cash'", [], |r| r.get(0),
    )?;
    let card_id: i64 = conn.query_row(
        "SELECT id FROM company_accounts WHERE account_type='card'", [], |r| r.get(0),
    )?;

    // ── Company expenses ─────────────────────────────────────────────
    let cat_rent: i64 = conn.query_row(
        "SELECT id FROM finance_categories WHERE name='Аренда'", [], |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, finance_category_id, description, transaction_date)
         VALUES ('company_expense_out', 15000, 'out', ?1, ?2, 'Аренда помещения за март', date('now'))",
        rusqlite::params![card_id, cat_rent],
    )?;
    conn.execute("UPDATE company_accounts SET balance = balance - 15000 WHERE id = ?1", rusqlite::params![card_id])?;

    let cat_mat: i64 = conn.query_row(
        "SELECT id FROM finance_categories WHERE name='Материалы'", [], |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, finance_category_id, description, transaction_date)
         VALUES ('company_expense_out', 3000, 'out', ?1, ?2, 'Бумага для печати', date('now'))",
        rusqlite::params![cash_id, cat_mat],
    )?;
    conn.execute("UPDATE company_accounts SET balance = balance - 3000 WHERE id = ?1", rusqlite::params![cash_id])?;

    // ── Supplier debt: 8000 ─────────────────────────────────────────
    conn.execute(
        "INSERT INTO liabilities (liability_type, counterparty_name, description, original_amount, opened_at)
         VALUES ('supplier_debt', 'ООО Фотоматериалы', 'Поставка фотобумаги и чернил', 8000, date('now'))",
        [],
    )?;
    let liability_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, liability_id, description, transaction_date)
         VALUES ('supplier_debt_opened', 8000, 'none', ?1, 'Открытие долга: ООО Фотоматериалы', date('now'))",
        rusqlite::params![liability_id],
    )?;

    // Partial payment of supplier debt: 3000
    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, liability_id, description, transaction_date)
         VALUES ('supplier_debt_paid', 3000, 'out', ?1, ?2, 'Частичная оплата долга ООО Фотоматериалы', date('now'))",
        rusqlite::params![cash_id, liability_id],
    )?;
    conn.execute("UPDATE liabilities SET paid_amount = 3000 WHERE id = ?1", rusqlite::params![liability_id])?;
    conn.execute("UPDATE company_accounts SET balance = balance - 3000 WHERE id = ?1", rusqlite::params![cash_id])?;

    // ── Partner contributions ────────────────────────────────────────
    let partner1_id: i64 = conn.query_row(
        "SELECT id FROM partners WHERE name = 'Партнёр 1'", [], |r| r.get(0),
    )?;
    let partner2_id: i64 = conn.query_row(
        "SELECT id FROM partners WHERE name = 'Партнёр 2'", [], |r| r.get(0),
    )?;

    // Partner 1 contributes 20000 to cash
    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
         VALUES ('partner_paid_company_expense', 20000, 'in', ?1, ?2, 'Вклад Партнёр 1 — стартовый капитал', date('now'))",
        rusqlite::params![cash_id, partner1_id],
    )?;
    conn.execute("UPDATE company_accounts SET balance = balance + 20000 WHERE id = ?1", rusqlite::params![cash_id])?;
    conn.execute(
        "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, description)
         VALUES (?1, 'contribution', 20000, 'Стартовый вклад')",
        rusqlite::params![partner1_id],
    )?;

    // Partner 2 contributes 20000 to cash
    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, partner_id, description, transaction_date)
         VALUES ('partner_paid_company_expense', 20000, 'in', ?1, ?2, 'Вклад Партнёр 2 — стартовый капитал', date('now'))",
        rusqlite::params![cash_id, partner2_id],
    )?;
    conn.execute("UPDATE company_accounts SET balance = balance + 20000 WHERE id = ?1", rusqlite::params![cash_id])?;
    conn.execute(
        "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, description)
         VALUES (?1, 'contribution', 20000, 'Стартовый вклад')",
        rusqlite::params![partner2_id],
    )?;

    // Partner 2 paid for equipment from personal funds (expense without account movement)
    let cat_equip: i64 = conn.query_row(
        "SELECT id FROM finance_categories WHERE name='Оборудование'", [], |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, partner_id, finance_category_id, description, transaction_date)
         VALUES ('partner_paid_company_expense', 5000, 'none', ?1, ?2, 'Партнёр 2 купил штатив из личных средств', date('now'))",
        rusqlite::params![partner2_id, cat_equip],
    )?;
    conn.execute(
        "INSERT INTO partner_settlement_entries (partner_id, entry_type, amount, description)
         VALUES (?1, 'contribution', 5000, 'Штатив (из личных средств)')",
        rusqlite::params![partner2_id],
    )?;

    // ── Other income ─────────────────────────────────────────────────
    let cat_other_income: i64 = conn.query_row(
        "SELECT id FROM finance_categories WHERE name='Прочий доход'", [], |r| r.get(0),
    )?;
    conn.execute(
        "INSERT INTO finance_transactions (transaction_type, amount, direction, account_id, finance_category_id, description, transaction_date)
         VALUES ('other_income_in', 2000, 'in', ?1, ?2, 'Аренда фотозоны на мероприятие', date('now'))",
        rusqlite::params![cash_id, cat_other_income],
    )?;
    conn.execute("UPDATE company_accounts SET balance = balance + 2000 WHERE id = ?1", rusqlite::params![cash_id])?;

    Ok(())
}

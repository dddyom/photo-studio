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

    // Book formats
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

    // Print formats
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

    Ok(())
}

fn seed_pricing(conn: &Connection) -> Result<(), rusqlite::Error> {
    let has_program: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM pricing_programs WHERE name = 'Цены'",
        [], |r| r.get(0),
    ).unwrap_or(false);
    if has_program { return Ok(()); }

    log::info!("Seeding pricing program...");

    // Deactivate old programs if they exist
    conn.execute(
        "UPDATE pricing_programs SET is_active = 0 WHERE name IN ('Стандарт', 'Оптовый', 'Прайс для профиков')",
        [],
    )?;

    conn.execute("INSERT INTO pricing_programs (name) VALUES ('Цены')", [])?;
    let pid = conn.last_insert_rowid();

    let ins = |kind: &str, mp: &str, pf: &str| -> Result<(), rusqlite::Error> {
        conn.execute(
            "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![pid, kind, mp, pf],
        )?;
        Ok(())
    };

    // ── Печать на фотолаборатории ────────────────────────────────
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

    // ── Широкоформатная печать (за 1 погонный метр) ──────────────
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

    // ── Холодная ламинация широкоформатной печати (за 1 кв.м) ────
    let wide_lam = [
        ("Матовая", 800), ("Глянцевая", 800), ("Лён", 1000), ("Алмазная", 1500),
    ];
    for (ltype, price) in wide_lam {
        ins("print",
            &format!("{{\"category\":\"wide_format_lamination\",\"lamination_type\":\"{ltype}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── Ламинация фотографий ─────────────────────────────────────
    let photo_lam = [
        ("10x15", 150), ("15x20", 150), ("20x30", 200), ("20x40", 250),
        ("30x40", 350), ("20x60", 350), ("30x60", 600), ("30x80", 800),
    ];
    for (fmt, price) in photo_lam {
        ins("print",
            &format!("{{\"category\":\"photo_lamination\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── Фото на магните ──────────────────────────────────────────
    let magnets = [
        ("7x10", 250), ("10x15", 300), ("15x20", 500), ("15x22", 530),
        ("20x30", 900), ("30x40", 1700),
    ];
    for (fmt, price) in magnets {
        ins("print",
            &format!("{{\"category\":\"photo_magnet\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── Фото на ПВХ ─────────────────────────────────────────────
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

    // ── Картина на ДСП с ламинацией ─────────────────────────────
    ins("print",
        "{\"category\":\"dsp_picture\",\"format\":\"30x42\"}",
        "{\"type\":\"fixed\",\"price\":5000}")?;

    // ── Фотокниги: блок на пластике (за 1 разворот) ─────────────
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

    // ── Фотокниги: блок на картоне PVC (за 1 разворот) ──────────
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

    // ── Обложки с ламинацией (за 1 обложку) ─────────────────────
    let lam_soft = [
        ("15x15", 800), ("15x20", 800), ("20x20", 1200), ("20x25", 1300),
        ("20x27", 1500), ("20x30", 1500), ("25x25", 2500), ("30x30", 2500),
        ("30x40", 3800), ("30x43", 3800),
    ];
    for (fmt, price) in lam_soft {
        ins("book",
            &format!("{{\"component\":\"cover\",\"cover_family\":\"laminated\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── Обложки с ламинацией твёрдые (за 1 обложку) ────────────
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

    // ── Обложки из экокожи (за 1 обложку) ────────────────────────
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

    // ── Доп. опции обложки ───────────────────────────────────────
    ins("book",
        "{\"component\":\"cover_option\",\"option_name\":\"Гравировка\"}",
        "{\"type\":\"fixed\",\"price\":1000}")?;
    ins("book",
        "{\"component\":\"cover_option\",\"option_name\":\"Фото-вставка\"}",
        "{\"type\":\"fixed\",\"price\":800}")?;

    // ── Холст с натяжкой на подрамник ────────────────────────────
    let canvas = [
        ("15x20", 3000), ("20x30", 3000), ("30x40", 4000), ("40x60", 5000),
        ("50x70", 6500), ("60x90", 9500), ("100x100", 18000), ("100x150", 27000),
    ];
    for (fmt, price) in canvas {
        ins("print",
            &format!("{{\"category\":\"canvas_stretched\",\"format\":\"{fmt}\"}}"),
            &format!("{{\"type\":\"fixed\",\"price\":{price}}}"))?;
    }

    // ── Двухсторонние календари ──────────────────────────────────
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

    conn.execute(
        "INSERT INTO finance_categories (name, category_type, is_system, sort_order) VALUES ('Оплата заказов', 'income', 1, 0)", [],
    )?;
    conn.execute(
        "INSERT INTO finance_categories (name, category_type, is_system, sort_order) VALUES ('Прочий доход', 'income', 0, 1)", [],
    )?;

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

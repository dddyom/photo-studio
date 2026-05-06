use rusqlite::Connection;

/// Each migration: (version, description, sql).
///
/// Rules:
/// - Append new migrations at the end with the next version number.
/// - Never modify or remove already-applied migrations.
/// - The `_migrations` table is bootstrapped before this list is consulted.
const MIGRATIONS: &[(i32, &str, &str)] = &[
    // ── v1: Foundation ──────────────────────────────────────────────
    (1, "foundation tables", "
        CREATE TABLE app_settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE partners (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT    NOT NULL,
            profit_share REAL    NOT NULL DEFAULT 0.5,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE company_accounts (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            name         TEXT    NOT NULL,
            account_type TEXT    NOT NULL CHECK (account_type IN ('cash','card','bank')),
            balance      REAL    NOT NULL DEFAULT 0,
            is_active    INTEGER NOT NULL DEFAULT 1,
            created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    "),

    // ── v2: Product catalogs ────────────────────────────────────────
    (2, "product catalog tables", "
        CREATE TABLE book_formats (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL UNIQUE,
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE print_formats (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL UNIQUE,
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE materials (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            category   TEXT    NOT NULL CHECK (category IN ('block','print','finishing')),
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE cover_types (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL UNIQUE,
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE cover_materials (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL UNIQUE,
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE lamination_types (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL UNIQUE,
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE extra_option_types (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL UNIQUE,
            default_price REAL,
            is_active     INTEGER NOT NULL DEFAULT 1,
            sort_order    INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE finance_categories (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT    NOT NULL,
            category_type TEXT    NOT NULL CHECK (category_type IN ('income','expense')),
            is_system     INTEGER NOT NULL DEFAULT 0,
            is_active     INTEGER NOT NULL DEFAULT 1,
            sort_order    INTEGER NOT NULL DEFAULT 0
        );
    "),

    // ── v3: Pricing ─────────────────────────────────────────────────
    (3, "pricing tables", "
        CREATE TABLE pricing_programs (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            is_active  INTEGER NOT NULL DEFAULT 1,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE pricing_rules (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            pricing_program_id INTEGER NOT NULL REFERENCES pricing_programs(id),
            item_kind          TEXT    NOT NULL CHECK (item_kind IN ('book','print','service','extra')),
            match_params       TEXT    NOT NULL DEFAULT '{}',
            price_formula      TEXT    NOT NULL DEFAULT '{}',
            is_active          INTEGER NOT NULL DEFAULT 1,
            created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_pricing_rules_program ON pricing_rules(pricing_program_id);
    "),

    // ── v4: Clients ─────────────────────────────────────────────────
    (4, "clients table", "
        CREATE TABLE clients (
            id                         INTEGER PRIMARY KEY AUTOINCREMENT,
            name                       TEXT    NOT NULL,
            phone                      TEXT,
            email                      TEXT,
            default_pricing_program_id INTEGER REFERENCES pricing_programs(id),
            notes                      TEXT,
            created_at                 TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at                 TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_clients_name ON clients(name);
    "),

    // ── v5: Orders core ─────────────────────────────────────────────
    (5, "orders and order items", "
        CREATE TABLE orders (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            number             TEXT    NOT NULL UNIQUE,
            client_id          INTEGER NOT NULL REFERENCES clients(id),
            pricing_program_id INTEGER REFERENCES pricing_programs(id),
            production_status  TEXT    NOT NULL DEFAULT 'draft'
                CHECK (production_status IN ('draft','confirmed','in_work','ready','closed','cancelled')),
            payment_status     TEXT    NOT NULL DEFAULT 'unpaid'
                CHECK (payment_status IN ('unpaid','partial','paid','overpaid')),
            delivery_status    TEXT    NOT NULL DEFAULT 'not_delivered'
                CHECK (delivery_status IN ('not_delivered','partially_delivered','delivered')),
            total_amount       REAL    NOT NULL DEFAULT 0,
            paid_amount        REAL    NOT NULL DEFAULT 0,
            notes              TEXT,
            due_date           TEXT,
            created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_orders_client      ON orders(client_id);
        CREATE INDEX idx_orders_prod_status ON orders(production_status);
        CREATE INDEX idx_orders_pay_status  ON orders(payment_status);
        CREATE INDEX idx_orders_created     ON orders(created_at);

        CREATE TABLE order_items (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id             INTEGER NOT NULL REFERENCES orders(id),
            item_kind            TEXT    NOT NULL CHECK (item_kind IN ('book','print','service','extra')),
            description          TEXT,
            qty                  INTEGER NOT NULL DEFAULT 1,
            unit_price           REAL    NOT NULL DEFAULT 0,
            total_price          REAL    NOT NULL DEFAULT 0,
            price_source         TEXT    NOT NULL DEFAULT 'auto'
                CHECK (price_source IN ('auto','manual')),
            manual_price_reason  TEXT,
            spec_snapshot_json   TEXT    NOT NULL DEFAULT '{}',
            price_breakdown_json TEXT    NOT NULL DEFAULT '{}',
            is_cancelled         INTEGER NOT NULL DEFAULT 0,
            sort_order           INTEGER NOT NULL DEFAULT 0,
            created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_order_items_order ON order_items(order_id);

        CREATE TABLE order_item_books (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            order_item_id     INTEGER NOT NULL UNIQUE REFERENCES order_items(id),
            book_format_id    INTEGER REFERENCES book_formats(id),
            spread_count      INTEGER NOT NULL DEFAULT 10,
            block_material_id INTEGER REFERENCES materials(id),
            cover_type_id     INTEGER REFERENCES cover_types(id),
            cover_material_id INTEGER REFERENCES cover_materials(id),
            lamination_id     INTEGER REFERENCES lamination_types(id)
        );

        CREATE TABLE order_item_prints (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            order_item_id     INTEGER NOT NULL UNIQUE REFERENCES order_items(id),
            print_format_id   INTEGER REFERENCES print_formats(id),
            print_material_id INTEGER REFERENCES materials(id),
            finishing_id      INTEGER REFERENCES materials(id)
        );

        CREATE TABLE order_item_extras (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            order_item_id        INTEGER NOT NULL REFERENCES order_items(id),
            extra_option_type_id INTEGER REFERENCES extra_option_types(id),
            custom_name          TEXT,
            qty                  INTEGER NOT NULL DEFAULT 1,
            unit_price           REAL    NOT NULL DEFAULT 0,
            total_price          REAL    NOT NULL DEFAULT 0
        );

        CREATE INDEX idx_order_item_extras_item ON order_item_extras(order_item_id);
    "),

    // ── v6: Finance ─────────────────────────────────────────────────
    // Must come before order operations (payments reference finance_transactions)
    (6, "finance tables", "
        CREATE TABLE finance_transactions (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_type      TEXT    NOT NULL
                CHECK (transaction_type IN (
                    'order_payment_in','order_refund_out',
                    'other_income_in','company_expense_out',
                    'transfer_between_accounts',
                    'supplier_debt_opened','supplier_debt_paid',
                    'partner_paid_company_expense','company_reimbursed_partner',
                    'partner_profit_payout','partner_draw',
                    'adjustment'
                )),
            amount                REAL    NOT NULL CHECK (amount >= 0),
            direction             TEXT    NOT NULL CHECK (direction IN ('in','out','none')),
            account_id            INTEGER REFERENCES company_accounts(id),
            counter_account_id    INTEGER REFERENCES company_accounts(id),
            linked_transaction_id INTEGER REFERENCES finance_transactions(id),
            order_id              INTEGER REFERENCES orders(id),
            liability_id          INTEGER,
            partner_id            INTEGER REFERENCES partners(id),
            finance_category_id   INTEGER REFERENCES finance_categories(id),
            description           TEXT,
            transaction_date      TEXT    NOT NULL DEFAULT (date('now')),
            created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_fin_tx_type    ON finance_transactions(transaction_type);
        CREATE INDEX idx_fin_tx_date    ON finance_transactions(transaction_date);
        CREATE INDEX idx_fin_tx_account ON finance_transactions(account_id);
        CREATE INDEX idx_fin_tx_order   ON finance_transactions(order_id);

        CREATE TABLE liabilities (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            liability_type    TEXT    NOT NULL CHECK (liability_type IN ('supplier_debt','other')),
            counterparty_name TEXT    NOT NULL,
            description       TEXT,
            original_amount   REAL    NOT NULL,
            paid_amount       REAL    NOT NULL DEFAULT 0,
            status            TEXT    NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','paid','cancelled')),
            opened_at         TEXT    NOT NULL DEFAULT (date('now')),
            due_date          TEXT,
            created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
            updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_liabilities_status ON liabilities(status);

        CREATE TABLE partner_settlement_entries (
            id                     INTEGER PRIMARY KEY AUTOINCREMENT,
            partner_id             INTEGER NOT NULL REFERENCES partners(id),
            entry_type             TEXT    NOT NULL
                CHECK (entry_type IN (
                    'contribution','reimbursement',
                    'profit_accrual','profit_payout',
                    'draw','adjustment'
                )),
            amount                 REAL    NOT NULL,
            finance_transaction_id INTEGER REFERENCES finance_transactions(id),
            description            TEXT,
            period                 TEXT,
            created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_partner_settle_partner ON partner_settlement_entries(partner_id);
        CREATE INDEX idx_partner_settle_period  ON partner_settlement_entries(period);

        CREATE TABLE closing_periods (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            period        TEXT    NOT NULL UNIQUE,
            total_income  REAL    NOT NULL DEFAULT 0,
            total_expense REAL    NOT NULL DEFAULT 0,
            profit        REAL    NOT NULL DEFAULT 0,
            status        TEXT    NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','closed')),
            closed_at     TEXT,
            created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
    "),

    // ── v7: Order operations ────────────────────────────────────────
    (7, "order payments, refunds, deliveries", "
        CREATE TABLE order_payments (
            id                     INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id               INTEGER NOT NULL REFERENCES orders(id),
            amount                 REAL    NOT NULL,
            payment_method         TEXT    NOT NULL CHECK (payment_method IN ('cash','card','bank_transfer')),
            account_id             INTEGER NOT NULL REFERENCES company_accounts(id),
            finance_transaction_id INTEGER REFERENCES finance_transactions(id),
            notes                  TEXT,
            paid_at                TEXT    NOT NULL DEFAULT (datetime('now')),
            created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_order_payments_order ON order_payments(order_id);

        CREATE TABLE order_refunds (
            id                     INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id               INTEGER NOT NULL REFERENCES orders(id),
            amount                 REAL    NOT NULL,
            payment_method         TEXT    NOT NULL CHECK (payment_method IN ('cash','card','bank_transfer')),
            account_id             INTEGER NOT NULL REFERENCES company_accounts(id),
            finance_transaction_id INTEGER REFERENCES finance_transactions(id),
            reason                 TEXT,
            refunded_at            TEXT    NOT NULL DEFAULT (datetime('now')),
            created_at             TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_order_refunds_order ON order_refunds(order_id);

        CREATE TABLE order_deliveries (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id     INTEGER NOT NULL REFERENCES orders(id),
            delivered_by TEXT,
            notes        TEXT,
            delivered_at TEXT    NOT NULL DEFAULT (datetime('now')),
            created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX idx_order_deliveries_order ON order_deliveries(order_id);
    "),

    // ── v8: Client archiving ──────────────────────────────────────────
    (8, "add is_archived to clients", "
        ALTER TABLE clients ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;
    "),

    // ── v9: Real pricing support ──────────────────────────────────────
    (9, "extend books with assembly_kind and cover_family, add catalog entries", "
        -- Book detail: assembly kind and cover family for composite pricing
        ALTER TABLE order_item_books ADD COLUMN assembly_kind TEXT;
        ALTER TABLE order_item_books ADD COLUMN cover_family TEXT;

        -- New book formats needed for real price list
        INSERT OR IGNORE INTO book_formats (name, sort_order) VALUES ('15x15', 1);
        INSERT OR IGNORE INTO book_formats (name, sort_order) VALUES ('15x20', 2);
        INSERT OR IGNORE INTO book_formats (name, sort_order) VALUES ('20x25', 6);
        INSERT OR IGNORE INTO book_formats (name, sort_order) VALUES ('20x27', 7);
        INSERT OR IGNORE INTO book_formats (name, sort_order) VALUES ('21x30', 9);
        INSERT OR IGNORE INTO book_formats (name, sort_order) VALUES ('30x43', 14);

        -- New print formats needed for real price list
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('7x10', 1);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('15x20', 3);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('15x22', 5);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('15x23', 6);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('20x33', 8);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('20x40', 9);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('20x60', 10);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('30x41', 12);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('30x42', 13);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('30x43', 14);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('30x44', 15);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('30x60', 17);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('30x80', 18);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('30x90', 19);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('40x60', 20);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('50x70', 21);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('60x90', 22);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('100x100', 23);
        INSERT OR IGNORE INTO print_formats (name, sort_order) VALUES ('100x150', 24);

        -- Deactivate old demo pricing programs
        UPDATE pricing_programs SET is_active = 0 WHERE name IN ('Стандарт', 'Оптовый');
    "),

    // ── v10: Dynamic catalogs for pricing ───────────────────────────────
    (10, "dynamic catalogs for pricing options", "
        -- Print categories (replaces hardcoded 9 categories)
        CREATE TABLE print_categories (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            code       TEXT    NOT NULL UNIQUE,
            name       TEXT    NOT NULL,
            unit       TEXT    NOT NULL DEFAULT 'шт.',
            field_type TEXT    NOT NULL DEFAULT 'format',
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO print_categories (code, name, unit, field_type, sort_order) VALUES
            ('lab_print',              'Лабораторная печать',       'шт.',   'format',     1),
            ('wide_format_print',      'Широкоформатная печать',    'пог. м', 'material',  2),
            ('wide_format_lamination', 'Ламинация широкоформатки',  'кв. м', 'lamination', 3),
            ('photo_lamination',       'Ламинация фото',            'шт.',   'format',     4),
            ('photo_magnet',           'Фото на магните',           'шт.',   'format',     5),
            ('photo_pvc',              'Фото на ПВХ',              'шт.',   'format',     6),
            ('dsp_picture',            'Картина на ДСП',            'шт.',   'format',     7),
            ('canvas_stretched',       'Холст на подрамнике',       'шт.',   'format',     8),
            ('calendar_double_sided',  'Двусторонний календарь',    'шт.',   'format',     9);

        -- Assembly kinds for books
        CREATE TABLE assembly_kinds (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            code       TEXT    NOT NULL UNIQUE,
            name       TEXT    NOT NULL,
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO assembly_kinds (code, name, sort_order) VALUES
            ('plastic',   'Пластик',    1),
            ('pvc_board', 'Картон PVC', 2);

        -- Cover families for books
        CREATE TABLE cover_families (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            code       TEXT    NOT NULL UNIQUE,
            name       TEXT    NOT NULL,
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO cover_families (code, name, sort_order) VALUES
            ('laminated_hard', 'Ламинированная твёрдая', 1),
            ('eco_leather',    'Экокожа',                2);

        -- Book cover options
        CREATE TABLE book_cover_options (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL UNIQUE,
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO book_cover_options (name, sort_order) VALUES
            ('Гравировка',   1),
            ('Фото-вставка', 2);

        -- Wide format materials
        CREATE TABLE wide_format_materials (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL UNIQUE,
            is_active  INTEGER NOT NULL DEFAULT 1,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        INSERT INTO wide_format_materials (name, sort_order) VALUES
            ('Фотобумага матовая 106 см, самоклейка', 1),
            ('Печать на холсте, ширина 60 см',        2),
            ('Печать на холсте, ширина 90 см',        3);

        -- Seed lamination types (already exists as table, just add entries if empty)
        INSERT OR IGNORE INTO lamination_types (name, sort_order) VALUES
            ('Матовая',    1),
            ('Глянцевая',  2),
            ('Лён',        3),
            ('Алмазная',   4);
    "),

    // ── v11: Per-item production step tracking ────────────────────────
    (11, "per-item production steps", "
        ALTER TABLE order_items ADD COLUMN production_step TEXT NOT NULL DEFAULT 'pending'
            CHECK (production_step IN ('pending','printed','assembled','done'));

        CREATE TABLE production_log (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            order_item_id INTEGER NOT NULL REFERENCES order_items(id),
            from_step     TEXT    NOT NULL,
            to_step       TEXT    NOT NULL,
            changed_at    TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX idx_production_log_item ON production_log(order_item_id);
        CREATE INDEX idx_production_log_time ON production_log(changed_at);

        -- Backfill: items in ready/closed orders are done
        UPDATE order_items SET production_step = 'done'
        WHERE order_id IN (
            SELECT id FROM orders WHERE production_status IN ('ready', 'closed')
        ) AND is_cancelled = 0;
    "),
    (12, "add folder_path to orders", "
        ALTER TABLE orders ADD COLUMN folder_path TEXT;
    "),

    // ── v13: Normalize pricing rules JSON ────────────────────────────────
    (13, "normalize pricing rules JSON for consistent matching", "
        UPDATE pricing_rules SET
            match_params = json(match_params),
            price_formula = json(price_formula);
    "),

    // ── v14: Remove confirmed status, merge into in_work ──────────────
    (14, "merge confirmed status into in_work", "
        UPDATE orders SET production_status = 'in_work'
        WHERE production_status = 'confirmed';
    "),

    // ── v15: Production step flags on print categories ────────────────
    (15, "add has_printing and has_assembly to print_categories, category to order_item_prints", "
        ALTER TABLE print_categories ADD COLUMN has_printing INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE print_categories ADD COLUMN has_assembly INTEGER NOT NULL DEFAULT 0;

        -- Backfill: lamination categories don't need printing
        UPDATE print_categories SET has_printing = 0
        WHERE code IN ('wide_format_lamination', 'photo_lamination');

        -- Categories that need assembly
        UPDATE print_categories SET has_assembly = 1
        WHERE code IN ('photo_magnet', 'photo_pvc', 'dsp_picture', 'canvas_stretched');

        -- Store category on order_item_prints for production step lookup
        ALTER TABLE order_item_prints ADD COLUMN category TEXT;

        -- Backfill category from spec_snapshot_json
        UPDATE order_item_prints SET category = (
            SELECT json_extract(oi.spec_snapshot_json, '$.category')
            FROM order_items oi WHERE oi.id = order_item_prints.order_item_id
        );
    "),

    // ── v16: Cover families rework ──────────────────────────────────
    (16, "rework cover families: needs_lamination flag, cover options scoping", "
        -- Add needs_lamination flag to cover_families
        ALTER TABLE cover_families ADD COLUMN needs_lamination INTEGER NOT NULL DEFAULT 0;

        -- Add missing cover families
        INSERT OR IGNORE INTO cover_families (code, name, sort_order, needs_lamination)
            VALUES ('plain', 'Обычная', 0, 0);
        INSERT OR IGNORE INTO cover_families (code, name, sort_order, needs_lamination)
            VALUES ('laminated', 'С ламинацией', 1, 1);

        -- Update existing families
        UPDATE cover_families SET needs_lamination = 1 WHERE code = 'laminated_hard';
        UPDATE cover_families SET name = 'С ламинацией твёрдая', sort_order = 2
            WHERE code = 'laminated_hard';
        UPDATE cover_families SET sort_order = 3 WHERE code = 'eco_leather';

        -- Scope cover options to a specific cover family
        ALTER TABLE book_cover_options ADD COLUMN cover_family_code TEXT;
        UPDATE book_cover_options SET cover_family_code = 'eco_leather';

        -- Add missing lamination type
        INSERT OR IGNORE INTO lamination_types (name, sort_order) VALUES ('Кожа', 5);
    "),

    // ── v17: Unify cover options — lamination types become cover options ─
    (17, "unify cover options: join table for families, lamination as options", "
        -- Join table: one option can belong to multiple cover families
        CREATE TABLE cover_option_families (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            cover_option_id     INTEGER NOT NULL REFERENCES book_cover_options(id) ON DELETE CASCADE,
            cover_family_code   TEXT    NOT NULL,
            UNIQUE(cover_option_id, cover_family_code)
        );

        -- Migrate existing cover_family_code data into the join table
        INSERT OR IGNORE INTO cover_option_families (cover_option_id, cover_family_code)
            SELECT id, cover_family_code FROM book_cover_options WHERE cover_family_code IS NOT NULL;

        -- Add lamination type options (no price — purely informational)
        INSERT OR IGNORE INTO book_cover_options (name, sort_order) VALUES ('Глянцевая', 10);
        INSERT OR IGNORE INTO book_cover_options (name, sort_order) VALUES ('Матовая', 11);
        INSERT OR IGNORE INTO book_cover_options (name, sort_order) VALUES ('Лён', 12);
        INSERT OR IGNORE INTO book_cover_options (name, sort_order) VALUES ('Алмазная', 13);
        INSERT OR IGNORE INTO book_cover_options (name, sort_order) VALUES ('Кожа', 14);

        -- Link lamination options to both laminated families
        INSERT OR IGNORE INTO cover_option_families (cover_option_id, cover_family_code)
            SELECT id, 'laminated' FROM book_cover_options WHERE name IN ('Глянцевая', 'Матовая', 'Лён', 'Алмазная', 'Кожа');
        INSERT OR IGNORE INTO cover_option_families (cover_option_id, cover_family_code)
            SELECT id, 'laminated_hard' FROM book_cover_options WHERE name IN ('Глянцевая', 'Матовая', 'Лён', 'Алмазная', 'Кожа');
    "),

    // ── v18: Note on order items ────────────────────────────────────────
    (18, "add note column to order_items", "
        ALTER TABLE order_items ADD COLUMN note TEXT;
    "),

    // ── v19: Client balance ─────────────────────────────────────────────
    (19, "client balance and balance transactions", "
        ALTER TABLE clients ADD COLUMN balance REAL NOT NULL DEFAULT 0;

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
        );

        CREATE INDEX idx_client_balance_tx_client ON client_balance_transactions(client_id);
        CREATE INDEX idx_client_balance_tx_order  ON client_balance_transactions(order_id);
    "),

    // ── v20: Voidable finance transactions ──────────────────────────────
    // Soft-cancel for finance ops: keeps row in history, reverses side-effects.
    // surplus_to_balance + order_payment_id link order_payment_in → client surplus
    // so the cascade can undo the client balance deposit.
    (20, "voidable finance transactions", "
        ALTER TABLE finance_transactions ADD COLUMN voided_at TEXT;
        ALTER TABLE finance_transactions ADD COLUMN voided_reason TEXT;

        ALTER TABLE partner_settlement_entries ADD COLUMN voided_at TEXT;
        ALTER TABLE order_payments ADD COLUMN voided_at TEXT;
        ALTER TABLE order_payments ADD COLUMN surplus_to_balance REAL NOT NULL DEFAULT 0;
        ALTER TABLE order_refunds ADD COLUMN voided_at TEXT;
        ALTER TABLE client_balance_transactions ADD COLUMN voided_at TEXT;
        ALTER TABLE client_balance_transactions ADD COLUMN order_payment_id INTEGER REFERENCES order_payments(id);
    "),

    // ── v21: Fix overpaid orders caused by pay_order_from_balance bug ───
    // Older versions of pay_order_from_balance allowed paying more than the
    // remaining debt — the excess was silently drained from client balance
    // into orders.paid_amount, leaving the order overpaid and the client
    // short. We refund the portion attributable to balance payments back
    // onto the client's balance and reset paid_amount/payment_status.
    // Idempotent: targets only orders where paid_amount > total_amount.
    (21, "refund balance overpayments on overpaid orders", "
        CREATE TEMPORARY TABLE _v21_overpay_fix AS
        SELECT
          o.id          AS order_id,
          o.number      AS order_number,
          o.client_id   AS client_id,
          MIN(
            o.paid_amount - o.total_amount,
            COALESCE((
              SELECT SUM(amount) FROM client_balance_transactions
              WHERE order_id = o.id AND transaction_type = 'order_payment'
                AND voided_at IS NULL
            ), 0)
            - COALESCE((
              SELECT SUM(amount) FROM client_balance_transactions
              WHERE order_id = o.id AND transaction_type = 'order_surplus'
                AND voided_at IS NULL
            ), 0)
          ) AS refund_amount
        FROM orders o
        WHERE o.paid_amount > o.total_amount + 0.01;

        DELETE FROM _v21_overpay_fix WHERE refund_amount < 0.01;

        INSERT INTO client_balance_transactions
          (client_id, amount, direction, transaction_type, order_id, notes)
        SELECT client_id, refund_amount, 'in', 'order_surplus', order_id,
               'Миграция v21: возврат излишка по переплаченному заказу ' || order_number
        FROM _v21_overpay_fix;

        UPDATE clients SET
          balance = balance + COALESCE((
            SELECT SUM(refund_amount) FROM _v21_overpay_fix
            WHERE client_id = clients.id
          ), 0),
          updated_at = datetime('now')
        WHERE id IN (SELECT DISTINCT client_id FROM _v21_overpay_fix);

        UPDATE orders SET
          paid_amount = paid_amount - (
            SELECT refund_amount FROM _v21_overpay_fix WHERE order_id = orders.id
          ),
          payment_status = CASE
            WHEN paid_amount - (SELECT refund_amount FROM _v21_overpay_fix WHERE order_id = orders.id) <= 0
              THEN 'unpaid'
            WHEN ABS(paid_amount - (SELECT refund_amount FROM _v21_overpay_fix WHERE order_id = orders.id) - total_amount) < 0.01
              THEN 'paid'
            WHEN paid_amount - (SELECT refund_amount FROM _v21_overpay_fix WHERE order_id = orders.id) > total_amount
              THEN 'overpaid'
            ELSE 'partial'
          END,
          updated_at = datetime('now')
        WHERE id IN (SELECT order_id FROM _v21_overpay_fix);

        DROP TABLE _v21_overpay_fix;
    "),
];

/// Bootstrap the migrations tracking table and apply pending migrations.
pub fn run(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version     INTEGER PRIMARY KEY,
            description TEXT    NOT NULL,
            applied_at  TEXT    NOT NULL DEFAULT (datetime('now'))
        );"
    )?;

    let current_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    log::info!("DB schema version: {current_version}");

    for &(version, description, sql) in MIGRATIONS {
        if version <= current_version {
            continue;
        }
        log::info!("Applying migration v{version}: {description}");
        conn.execute_batch(sql)?;
        conn.execute(
            "INSERT INTO _migrations (version, description) VALUES (?1, ?2)",
            rusqlite::params![version, description],
        )?;
    }

    let new_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if new_version > current_version {
        log::info!("Migrated to v{new_version}");
    }

    Ok(())
}

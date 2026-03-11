# Database Schema

SQLite schema for Photo Studio MVP. All tables created via versioned migrations in `src-tauri/src/db/migrations.rs`.

## Tables overview

### Foundation (v1)
| Table | Purpose |
|-------|---------|
| `app_settings` | Key-value store for app configuration |
| `partners` | Business partners (2 records, 50/50 profit split) |
| `company_accounts` | Cash, card, bank accounts with cached balance |

### Product catalogs (v2)
| Table | Purpose |
|-------|---------|
| `book_formats` | Album formats: 15x15, 15x20, 20x20, 20x25, 20x27, 20x30, 21x30, 30x30, 30x40, 30x43, etc. |
| `print_formats` | Print sizes: 7x10, 10x15, 15x20, 15x21, 15x22, 15x23, 20x30, 20x33, 20x40, 30x40, 30x42, 30x43, 30x60, 30x90, etc. |
| `materials` | Materials with `category`: block, print, finishing |
| `cover_types` | Book cover types: hard, soft |
| `cover_materials` | Cover materials: leather, fabric, etc. |
| `lamination_types` | Lamination options: glossy, matte, none |
| `extra_option_types` | Optional extras with default prices |
| `finance_categories` | Income/expense categories for transactions |

All catalog tables have `is_active` (soft deactivation) and `sort_order`.

### Pricing (v3)
| Table | Purpose |
|-------|---------|
| `pricing_programs` | Named pricing tiers: Standard, Wholesale, etc. |
| `pricing_rules` | Rules per program + item_kind, with JSON match params and price formula |

### Clients (v4)
| Table | Purpose |
|-------|---------|
| `clients` | Client directory with optional default pricing program |

### Orders (v5)
| Table | Purpose |
|-------|---------|
| `orders` | Order header: client, statuses, amounts |
| `order_items` | Line items: kind, qty, price, snapshot, breakdown |
| `order_item_books` | Book-specific detail (1:1 with order_items) |
| `order_item_prints` | Print-specific detail (1:1 with order_items) |
| `order_item_extras` | Extras attached to items (1:N) |

### Finance (v6)
| Table | Purpose |
|-------|---------|
| `finance_transactions` | Central financial journal |
| `liabilities` | Supplier debts with partial payment tracking |
| `partner_settlement_entries` | Partner accounting: contributions, payouts, draws |
| `closing_periods` | Monthly period close tracking |

### Order operations (v7)
| Table | Purpose |
|-------|---------|
| `order_payments` | Payment records linked to finance transactions |
| `order_refunds` | Refund records linked to finance transactions |
| `order_deliveries` | Delivery event log |

## Key relationships

```
clients ──< orders ──< order_items ──── order_item_books
                 │            │──── order_item_prints
                 │            └──< order_item_extras
                 │
                 ├──< order_payments ──> finance_transactions
                 ├──< order_refunds  ──> finance_transactions
                 └──< order_deliveries

pricing_programs ──< pricing_rules
                 └── clients.default_pricing_program_id
                 └── orders.pricing_program_id

company_accounts <── finance_transactions.account_id
partners         <── partner_settlement_entries
liabilities      <── finance_transactions.liability_id
```

## Order statuses

Three independent status fields on `orders`:

| Field | Values |
|-------|--------|
| `production_status` | draft, confirmed, in_work, ready, closed, cancelled |
| `payment_status` | unpaid, partial, paid, overpaid |
| `delivery_status` | not_delivered, partially_delivered, delivered |

`payment_status` is computed from `paid_amount` vs `total_amount` (updated by application logic on payment/refund).

## Finance transaction types

| Type | Direction | Affects account balance |
|------|-----------|------------------------|
| `order_payment_in` | in | yes |
| `order_refund_out` | out | yes |
| `other_income_in` | in | yes |
| `company_expense_out` | out | yes |
| `transfer_between_accounts` | in+out | yes (two linked records) |
| `supplier_debt_opened` | none | no |
| `supplier_debt_paid` | out | yes |
| `partner_paid_company_expense` | none | no |
| `company_reimbursed_partner` | out | yes |
| `partner_profit_payout` | out | yes |
| `partner_draw` | out | yes |
| `adjustment` | in/out | yes |

Transfers create two linked records via `linked_transaction_id`.

## Order item detail tables

| item_kind | Detail table | Relationship |
|-----------|-------------|-------------|
| book | `order_item_books` | 1:1 |
| print | `order_item_prints` | 1:1 |
| service | none (description in `order_items`) | — |
| extra | none (description in `order_items`) | — |

`order_item_extras` is 1:N — holds optional extras attached to any item (e.g. gift box for a book).

All items store `spec_snapshot_json` and `price_breakdown_json` for audit trail.

## Indexes

| Index | Table | Column(s) | Reason |
|-------|-------|-----------|--------|
| `idx_clients_name` | clients | name | Search by name |
| `idx_pricing_rules_program` | pricing_rules | pricing_program_id | FK lookup |
| `idx_orders_client` | orders | client_id | Orders by client |
| `idx_orders_prod_status` | orders | production_status | Filter by status |
| `idx_orders_pay_status` | orders | payment_status | Filter by status |
| `idx_orders_created` | orders | created_at | Sort by date |
| `idx_order_items_order` | order_items | order_id | Items for order |
| `idx_order_item_extras_item` | order_item_extras | order_item_id | Extras for item |
| `idx_order_payments_order` | order_payments | order_id | Payments for order |
| `idx_order_refunds_order` | order_refunds | order_id | Refunds for order |
| `idx_order_deliveries_order` | order_deliveries | order_id | Deliveries for order |
| `idx_fin_tx_type` | finance_transactions | transaction_type | Filter by type |
| `idx_fin_tx_date` | finance_transactions | transaction_date | Filter/sort by date |
| `idx_fin_tx_account` | finance_transactions | account_id | Transactions by account |
| `idx_fin_tx_order` | finance_transactions | order_id | Transactions by order |
| `idx_liabilities_status` | liabilities | status | Filter open debts |
| `idx_partner_settle_partner` | partner_settlement_entries | partner_id | By partner |
| `idx_partner_settle_period` | partner_settlement_entries | period | By period |

## Money storage

All monetary values use `REAL` (SQLite double). Sufficient precision for amounts in this business (typically 1–100,000 RUB range). No multi-currency support in MVP.

## Soft deactivation

Catalog tables use `is_active INTEGER DEFAULT 1`. Deactivated records remain in the DB for existing references but are hidden from selection dropdowns. No hard deletes for catalogs.

## Migrations v8–v9

**v8**: Added `is_archived INTEGER NOT NULL DEFAULT 0` to `clients` table for soft-archiving.

**v9**: Extended `order_item_books` with two new columns for composite book pricing:
- `assembly_kind TEXT` — block assembly type (e.g. "plastic", "pvc_board")
- `cover_family TEXT` — cover family (e.g. "laminated_hard", "eco_leather")

Also added new book formats (15x15, 15x20, 20x25, 20x27, 21x30, 30x43) and print formats (7x10, 15x20, 15x22, 15x23, 20x33, 20x40) via INSERT OR IGNORE.

## Seed data

On first launch, the app seeds:
- 2 partners (50/50)
- 3 company accounts (cash, card, bank)
- App settings (company name)
- Product catalogs (formats, materials, covers, laminations, extras)
- 1 pricing program «Цены» with real pricing rules (old demo programs deactivated)
- 7 finance categories

Demo data (clients, orders, transactions) is loaded separately via Settings page.

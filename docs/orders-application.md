# Orders Application Layer

Backend use-cases for the orders module. All commands are Tauri IPC commands in `src-tauri/src/commands/`.

## Modules

| File | Area |
|------|------|
| `commands/clients.rs` | Client CRUD + archive |
| `commands/pricing.rs` | Pricing programs, rules, price calculation |
| `commands/orders.rs` | Order lifecycle and queries |
| `commands/order_items.rs` | Order item management |
| `commands/order_payments.rs` | Payments, refunds, deliveries |

## Use-Cases

### Clients (`clients.rs`)

| Command | Description |
|---------|-------------|
| `list_clients` | List non-archived clients |
| `get_client(id)` | Get client by id |
| `create_client(input)` | Create client (validates non-empty name) |
| `update_client(id, input)` | Update client fields (partial update) |
| `archive_client(id)` | Soft-archive a client |

### Pricing (`pricing.rs`)

| Command | Description |
|---------|-------------|
| `list_pricing_programs` | All pricing programs |
| `list_pricing_rules(pricing_program_id)` | Rules for a program |

Internal function `calculate_price(conn, program_id, item_kind, spec, qty)` is called by order item commands.

### Orders (`orders.rs`)

| Command | Description |
|---------|-------------|
| `create_order(input)` | Create draft order with auto-generated number (YYMM-NNN) |
| `get_order(id)` | Get order with client name and computed debt_amount |
| `update_order(id, input)` | Update notes/due_date (draft only) |
| `confirm_order(id)` | draft -> confirmed |
| `cancel_order(id)` | draft/confirmed/in_work -> cancelled |
| `update_production_status(id, status)` | Validated forward transitions |
| `update_delivery_status(id, status)` | Set delivery status (not on draft/cancelled) |
| `list_orders(filter)` | Filter by client, statuses, date range, unpaid, delivered_but_unpaid |

### Order Items (`order_items.rs`)

| Command | Description |
|---------|-------------|
| `list_order_items(order_id)` | All items for an order |
| `add_book_item(input)` | Add book with auto-pricing + spec snapshot |
| `add_print_item(input)` | Add print with auto-pricing + spec snapshot |
| `add_service_item(input)` | Add service (always manual price) |
| `add_extra_item(input)` | Add standalone extra (from catalog or custom) |
| `cancel_order_item(item_id)` | Hard delete in draft, soft-cancel in confirmed+ |
| `update_order_item_price(item_id, input)` | Manual price override with required reason |

### Payments & Deliveries (`order_payments.rs`)

| Command | Description |
|---------|-------------|
| `register_payment(input)` | Record payment + create finance_transaction + update balances |
| `register_refund(input)` | Record refund + create finance_transaction + update balances |
| `register_delivery(input)` | Record delivery event + auto-set delivery_status |
| `list_order_payments(order_id)` | Payment history |
| `list_order_refunds(order_id)` | Refund history |
| `list_order_deliveries(order_id)` | Delivery history |

## Pricing Logic

Three formula types, stored as JSON in `pricing_rules.price_formula`:

### `fixed`
```json
{"type": "fixed", "price": 50}
```
`unit_price = price`, `total = price * qty`

### `base_plus_per_unit`
```json
{"type": "base_plus_per_unit", "base": 0, "per_unit": 200, "unit_field": "spread_count"}
```
`unit_price = base + per_unit * spec[unit_field]`, `total = unit_price * qty`

### `book_composite` (composite book pricing)

When a book item has `assembly_kind` set, pricing uses composite breakdown:

```
unit_price = block_per_spread × spread_count + cover_price + Σ cover_option_prices
```

Three separate rule lookups per book:
1. **Block**: `match_params = {"component": "block", "assembly_kind": "...", "format": "..."}` — uses `base_plus_per_unit` formula
2. **Cover**: `match_params = {"component": "cover", "cover_family": "...", "format": "..."}` — uses `fixed` formula
3. **Cover options**: `match_params = {"component": "cover_option", "option_name": "..."}` — uses `fixed` formula (per option)

If `assembly_kind` is empty/absent, falls back to legacy single-rule matching.

### Print category-based matching

Print rules use `category` in `match_params` to distinguish print types (lab_print, wide_format_print, photo_pvc, etc.). The `category` field is passed in the spec alongside format/material.

### Rule matching
- Rules filtered by `pricing_program_id` + `item_kind` + `is_active`
- `match_params` JSON: every key must match corresponding spec value
- Empty `{}` matches everything (fallback rule)
- Most specific rule wins (most keys in match_params)

### Manual override
- Any item can have `price_source = "manual"` with `manual_price_reason`
- Services always have manual prices
- Extras use `default_price` from `extra_option_types` catalog if not specified

## Snapshots

Every order item stores:
- `spec_snapshot_json` — human-readable spec at time of creation (format names, material names, etc.)
- `price_breakdown_json` — full calculation details (formula type, base, per_unit, rule_id, etc.)

These are immutable audit records. Changing pricing rules does not affect existing orders.

## Finance Integration

### Payment flow
1. `INSERT finance_transactions` (type `order_payment_in`, direction `in`)
2. `UPDATE company_accounts` (balance + amount)
3. `INSERT order_payments` (with `finance_transaction_id` link)
4. `UPDATE orders` (paid_amount + amount)
5. Recompute `payment_status` from paid_amount vs total_amount

### Refund flow
Same as payment but reversed: type `order_refund_out`, direction `out`, balance decreases.

### Payment status computation
| Condition | Status |
|-----------|--------|
| paid_amount = 0 | unpaid |
| 0 < paid_amount < total_amount | partial |
| paid_amount = total_amount (within 0.01) | paid |
| paid_amount > total_amount | overpaid |

## Status Transitions

### Production status
```
draft -> confirmed -> in_work -> ready -> closed
  \        \            \
   \--------\-----------+-----> cancelled
```

### Delivery status
Independently set: `not_delivered` -> `partially_delivered` -> `delivered`

Delivery is allowed regardless of payment status.

## Order Numbering

Format: `YYMM-NNN` (e.g., `2603-042`). Auto-incremented per month prefix.

## DB Migrations v8–v9

**v8**: Added `is_archived INTEGER NOT NULL DEFAULT 0` to `clients` table for soft-archiving.

**v9**: Added `assembly_kind TEXT` and `cover_family TEXT` columns to `order_item_books` for composite pricing. Added new book and print formats.

## Tests

19 integration tests in `tests/orders_integration.rs`:

- **Pricing**: fixed formula, base_plus_per_unit formula, lab print pricing, photo PVC pricing, wide format lamination pricing, book composite pricing (plastic + eco_leather), book composite pricing (pvc_board + laminated_hard), cover options (engraving + photo_insert), book composite snapshot
- **Order lifecycle**: create draft, status transitions, item addition with total recalculation, item cancellation
- **Payments**: partial payment updates status, full payment sets "paid", refund decreases paid_amount, finance transaction created
- **Delivery**: delivery updates status, delivery allowed with unpaid order
- **Filters**: unpaid filter, delivered_but_unpaid filter, production status filter

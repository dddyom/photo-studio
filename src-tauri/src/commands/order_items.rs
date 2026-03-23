use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::orders::recalculate_order_total;
use crate::commands::pricing;
use crate::db::DbState;

// ── DTOs ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderItem {
    pub id: i64,
    pub order_id: i64,
    pub item_kind: String,
    pub description: Option<String>,
    pub qty: i32,
    pub unit_price: f64,
    pub total_price: f64,
    pub price_source: String,
    pub manual_price_reason: Option<String>,
    pub spec_snapshot_json: String,
    pub price_breakdown_json: String,
    pub is_cancelled: bool,
    pub production_step: String,
    pub note: Option<String>,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct AddBookItemInput {
    pub order_id: i64,
    pub book_format_id: i64,
    pub spread_count: i32,
    pub assembly_kind: Option<String>,
    pub cover_family: Option<String>,
    pub cover_options: Option<Vec<String>>,
    pub block_material_id: Option<i64>,
    pub cover_type_id: Option<i64>,
    pub cover_material_id: Option<i64>,
    pub qty: i32,
    pub manual_price: Option<f64>,
    pub manual_price_reason: Option<String>,
    pub note: Option<String>,
    pub extras: Option<Vec<ExtraInput>>,
}

#[derive(Debug, Deserialize)]
pub struct AddPrintItemInput {
    pub order_id: i64,
    pub category: Option<String>,
    pub print_format_id: Option<i64>,
    pub print_material_id: Option<i64>,
    pub finishing_id: Option<i64>,
    pub wide_format_material: Option<String>,
    pub lamination_type: Option<String>,
    pub qty: i32,
    pub manual_price: Option<f64>,
    pub manual_price_reason: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddServiceItemInput {
    pub order_id: i64,
    pub description: String,
    pub qty: i32,
    pub unit_price: f64,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AddExtraItemInput {
    pub order_id: i64,
    pub extra_option_type_id: Option<i64>,
    pub custom_name: Option<String>,
    pub qty: i32,
    pub unit_price: Option<f64>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExtraInput {
    pub extra_option_type_id: Option<i64>,
    pub custom_name: Option<String>,
    pub qty: i32,
    pub unit_price: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateItemPriceInput {
    pub unit_price: f64,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateOrderItemInput {
    pub qty: Option<i32>,
    pub unit_price: Option<f64>,
    pub description: Option<String>,
    pub manual_price_reason: Option<String>,
}

// ── Internal helpers ─────────────────────────────────────────────────

pub fn read_order_item_pub(conn: &Connection, id: i64) -> Result<OrderItem, String> {
    read_order_item(conn, id)
}

fn read_order_item(conn: &Connection, id: i64) -> Result<OrderItem, String> {
    conn.query_row(
        "SELECT id, order_id, item_kind, description, qty, unit_price, total_price,
                price_source, manual_price_reason, spec_snapshot_json, price_breakdown_json,
                is_cancelled, production_step, note, sort_order, created_at, updated_at
         FROM order_items WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(OrderItem {
                id: row.get(0)?,
                order_id: row.get(1)?,
                item_kind: row.get(2)?,
                description: row.get(3)?,
                qty: row.get(4)?,
                unit_price: row.get(5)?,
                total_price: row.get(6)?,
                price_source: row.get(7)?,
                manual_price_reason: row.get(8)?,
                spec_snapshot_json: row.get(9)?,
                price_breakdown_json: row.get(10)?,
                is_cancelled: row.get(11)?,
                production_step: row.get(12)?,
                note: row.get(13)?,
                sort_order: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

fn get_order_status(conn: &Connection, order_id: i64) -> Result<String, String> {
    conn.query_row(
        "SELECT production_status FROM orders WHERE id = ?1",
        rusqlite::params![order_id],
        |row| row.get(0),
    )
    .map_err(|_| "Заказ не найден".to_string())
}

fn get_order_pricing_program(conn: &Connection, order_id: i64) -> Result<Option<i64>, String> {
    conn.query_row(
        "SELECT pricing_program_id FROM orders WHERE id = ?1",
        rusqlite::params![order_id],
        |row| row.get(0),
    )
    .map_err(|_| "Заказ не найден".to_string())
}

fn next_sort_order(conn: &Connection, order_id: i64) -> Result<i32, String> {
    let max: Option<i32> = conn
        .query_row(
            "SELECT MAX(sort_order) FROM order_items WHERE order_id = ?1",
            rusqlite::params![order_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    Ok(max.unwrap_or(-1) + 1)
}

/// Look up a catalog name by table and id. Returns empty string if not found.
fn catalog_name(conn: &Connection, table: &str, id: i64) -> String {
    // Only allow known safe table names (no SQL injection)
    let allowed = [
        "book_formats",
        "print_formats",
        "materials",
        "cover_types",
        "cover_materials",
        "lamination_types",
        "extra_option_types",
    ];
    if !allowed.contains(&table) {
        return String::new();
    }
    let sql = format!("SELECT name FROM {table} WHERE id = ?1");
    conn.query_row(&sql, rusqlite::params![id], |row| row.get::<_, String>(0))
        .unwrap_or_default()
}

// ── Commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub fn list_order_items(db: State<DbState>, order_id: i64) -> Result<Vec<OrderItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, order_id, item_kind, description, qty, unit_price, total_price,
                    price_source, manual_price_reason, spec_snapshot_json, price_breakdown_json,
                    is_cancelled, production_step, note, sort_order, created_at, updated_at
             FROM order_items WHERE order_id = ?1 ORDER BY sort_order",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![order_id], |row| {
            Ok(OrderItem {
                id: row.get(0)?,
                order_id: row.get(1)?,
                item_kind: row.get(2)?,
                description: row.get(3)?,
                qty: row.get(4)?,
                unit_price: row.get(5)?,
                total_price: row.get(6)?,
                price_source: row.get(7)?,
                manual_price_reason: row.get(8)?,
                spec_snapshot_json: row.get(9)?,
                price_breakdown_json: row.get(10)?,
                is_cancelled: row.get(11)?,
                production_step: row.get(12)?,
                note: row.get(13)?,
                sort_order: row.get(14)?,
                created_at: row.get(15)?,
                updated_at: row.get(16)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn add_book_item(db: State<DbState>, input: AddBookItemInput) -> Result<OrderItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.qty < 1 {
        return Err("Количество должно быть >= 1".to_string());
    }

    let status = get_order_status(&conn, input.order_id)?;
    if status != "draft" && status != "in_work" {
        return Err("Добавление позиций доступно только для черновика или заказа в работе".to_string());
    }

    // Build spec snapshot with human-readable names
    let format_name = catalog_name(&conn, "book_formats", input.book_format_id);
    let block_name = input
        .block_material_id
        .map(|id| catalog_name(&conn, "materials", id))
        .unwrap_or_default();
    let cover_type_name = input
        .cover_type_id
        .map(|id| catalog_name(&conn, "cover_types", id))
        .unwrap_or_default();
    let cover_mat_name = input
        .cover_material_id
        .map(|id| catalog_name(&conn, "cover_materials", id))
        .unwrap_or_default();
    let assembly_kind = input.assembly_kind.clone().unwrap_or_default();
    let cover_family = input.cover_family.clone().unwrap_or_default();
    let cover_options = input.cover_options.clone().unwrap_or_default();

    let spec = serde_json::json!({
        "format": format_name,
        "spread_count": input.spread_count,
        "assembly_kind": assembly_kind,
        "cover_family": cover_family,
        "cover_options": cover_options,
        "block_material": block_name,
        "cover_type": cover_type_name,
        "cover_material": cover_mat_name,
    });
    let spec_json = spec.to_string();

    // Description for human display
    let assembly_label = match assembly_kind.as_str() {
        "plastic" => "пластик",
        "pvc_board" => "картон PVC",
        _ => "",
    };
    let cover_label = match cover_family.as_str() {
        "plain" => "обычная",
        "laminated" => "лам.",
        "laminated_hard" => "лам. твёрдая",
        "eco_leather" => "экокожа",
        _ => &cover_type_name,
    };
    let description = if !assembly_label.is_empty() {
        format!(
            "Фотокнига {}, {} разв., {}, {}",
            format_name, input.spread_count, assembly_label, cover_label
        )
    } else {
        format!(
            "Фотокнига {}, {} разв., {}",
            format_name, input.spread_count, cover_label
        )
    };

    // Calculate price
    let (unit_price, total_price, price_source, manual_reason, breakdown_json) =
        if let Some(mp) = input.manual_price {
            let reason = input
                .manual_price_reason
                .ok_or("Причина ручной цены обязательна")?;
            let total = mp * input.qty as f64;
            let breakdown = serde_json::json!({
                "source": "manual",
                "unit_price": mp,
                "qty": input.qty,
                "total_price": total,
                "reason": reason,
            });
            (mp, total, "manual", Some(reason), breakdown.to_string())
        } else {
            let program_id = get_order_pricing_program(&conn, input.order_id)?
                .ok_or("Программа ценообразования не задана для заказа")?;
            let calc = pricing::calculate_book_price(&conn, program_id, &spec, input.qty)?;
            (
                calc.unit_price,
                calc.total_price,
                "auto",
                None,
                calc.breakdown_json,
            )
        };

    let sort = next_sort_order(&conn, input.order_id)?;

    conn.execute(
        "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price,
            price_source, manual_price_reason, spec_snapshot_json, price_breakdown_json, note, sort_order)
         VALUES (?1, 'book', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            input.order_id,
            description,
            input.qty,
            unit_price,
            total_price,
            price_source,
            manual_reason,
            spec_json,
            breakdown_json,
            input.note,
            sort,
        ],
    )
    .map_err(|e| e.to_string())?;

    let item_id = conn.last_insert_rowid();

    // Insert book detail row
    conn.execute(
        "INSERT INTO order_item_books (order_item_id, book_format_id, spread_count,
            block_material_id, cover_type_id, cover_material_id,
            assembly_kind, cover_family)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            item_id,
            input.book_format_id,
            input.spread_count,
            input.block_material_id,
            input.cover_type_id,
            input.cover_material_id,
            input.assembly_kind,
            input.cover_family,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Insert extras if provided
    if let Some(extras) = input.extras {
        for extra in extras {
            let extra_price = match extra.unit_price {
                Some(p) => p,
                None => match extra.extra_option_type_id {
                    Some(eid) => pricing::get_extra_default_price(&conn, eid)?
                        .unwrap_or(0.0),
                    None => 0.0,
                },
            };
            let extra_total = extra_price * extra.qty as f64;
            conn.execute(
                "INSERT INTO order_item_extras (order_item_id, extra_option_type_id, custom_name,
                    qty, unit_price, total_price)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    item_id,
                    extra.extra_option_type_id,
                    extra.custom_name,
                    extra.qty,
                    extra_price,
                    extra_total,
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    recalculate_order_total(&conn, input.order_id)?;
    read_order_item(&conn, item_id)
}

#[tauri::command]
pub fn add_print_item(db: State<DbState>, input: AddPrintItemInput) -> Result<OrderItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.qty < 1 {
        return Err("Количество должно быть >= 1".to_string());
    }

    let status = get_order_status(&conn, input.order_id)?;
    if status != "draft" && status != "in_work" {
        return Err("Добавление позиций доступно только для черновика или заказа в работе".to_string());
    }

    let category = input.category.clone().unwrap_or_else(|| "lab_print".to_string());
    let format_name = input.print_format_id
        .map(|id| catalog_name(&conn, "print_formats", id))
        .unwrap_or_default();
    let material_name = input
        .print_material_id
        .map(|id| catalog_name(&conn, "materials", id))
        .unwrap_or_default();
    let finishing_name = input
        .finishing_id
        .map(|id| catalog_name(&conn, "materials", id))
        .unwrap_or_default();
    let wide_material = input.wide_format_material.clone().unwrap_or_default();
    let lam_type = input.lamination_type.clone().unwrap_or_default();

    // Build spec with category for rule matching
    let mut spec_map = serde_json::Map::new();
    spec_map.insert("category".to_string(), serde_json::json!(category));
    if !format_name.is_empty() {
        spec_map.insert("format".to_string(), serde_json::json!(format_name));
    }
    if !material_name.is_empty() {
        spec_map.insert("material".to_string(), serde_json::json!(material_name));
    }
    if !finishing_name.is_empty() {
        spec_map.insert("finishing".to_string(), serde_json::json!(finishing_name));
    }
    if !wide_material.is_empty() {
        spec_map.insert("material".to_string(), serde_json::json!(wide_material));
    }
    if !lam_type.is_empty() {
        spec_map.insert("lamination_type".to_string(), serde_json::json!(lam_type));
    }
    let spec = serde_json::Value::Object(spec_map);
    let spec_json = spec.to_string();

    // Human-readable category labels
    let cat_label = match category.as_str() {
        "lab_print" => "Печать",
        "wide_format_print" => "Широкоформатная печать",
        "wide_format_lamination" => "Ламинация широкоформатная",
        "photo_lamination" => "Ламинация фото",
        "photo_magnet" => "Фото на магните",
        "photo_pvc" => "Фото на ПВХ",
        "dsp_picture" => "Картина на ДСП",
        "canvas_stretched" => "Холст на подрамнике",
        "calendar_double_sided" => "Двухсторонний календарь",
        _ => "Печать",
    };

    let description = if !format_name.is_empty() {
        format!("{} {}", cat_label, format_name)
    } else if !wide_material.is_empty() {
        format!("{}, {}", cat_label, wide_material)
    } else if !lam_type.is_empty() {
        format!("{}, {}", cat_label, lam_type)
    } else {
        cat_label.to_string()
    };

    let (unit_price, total_price, price_source, manual_reason, breakdown_json) =
        if let Some(mp) = input.manual_price {
            let reason = input
                .manual_price_reason
                .ok_or("Причина ручной цены обязательна")?;
            let total = mp * input.qty as f64;
            let breakdown = serde_json::json!({
                "source": "manual",
                "unit_price": mp,
                "qty": input.qty,
                "total_price": total,
                "reason": reason,
            });
            (mp, total, "manual", Some(reason), breakdown.to_string())
        } else {
            let program_id = get_order_pricing_program(&conn, input.order_id)?
                .ok_or("Программа ценообразования не задана для заказа")?;
            let calc = pricing::calculate_price(&conn, program_id, "print", &spec, input.qty)?;
            (
                calc.unit_price,
                calc.total_price,
                "auto",
                None,
                calc.breakdown_json,
            )
        };

    let sort = next_sort_order(&conn, input.order_id)?;

    conn.execute(
        "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price,
            price_source, manual_price_reason, spec_snapshot_json, price_breakdown_json, note, sort_order)
         VALUES (?1, 'print', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        rusqlite::params![
            input.order_id,
            description,
            input.qty,
            unit_price,
            total_price,
            price_source,
            manual_reason,
            spec_json,
            breakdown_json,
            input.note,
            sort,
        ],
    )
    .map_err(|e| e.to_string())?;

    let item_id = conn.last_insert_rowid();

    conn.execute(
        "INSERT INTO order_item_prints (order_item_id, print_format_id, print_material_id, finishing_id, category)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            item_id,
            input.print_format_id,
            input.print_material_id,
            input.finishing_id,
            category,
        ],
    )
    .map_err(|e| e.to_string())?;

    recalculate_order_total(&conn, input.order_id)?;
    read_order_item(&conn, item_id)
}

#[tauri::command]
pub fn add_service_item(
    db: State<DbState>,
    input: AddServiceItemInput,
) -> Result<OrderItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.qty < 1 {
        return Err("Количество должно быть >= 1".to_string());
    }
    if input.description.trim().is_empty() {
        return Err("Описание услуги обязательно".to_string());
    }

    let status = get_order_status(&conn, input.order_id)?;
    if status != "draft" && status != "in_work" {
        return Err("Добавление позиций доступно только для черновика или заказа в работе".to_string());
    }

    let total = input.unit_price * input.qty as f64;
    let spec = serde_json::json!({
        "service_name": input.description,
    });
    let breakdown = serde_json::json!({
        "source": "manual",
        "unit_price": input.unit_price,
        "qty": input.qty,
        "total_price": total,
    });

    let sort = next_sort_order(&conn, input.order_id)?;

    conn.execute(
        "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price,
            price_source, spec_snapshot_json, price_breakdown_json, note, sort_order)
         VALUES (?1, 'service', ?2, ?3, ?4, ?5, 'manual', ?6, ?7, ?8, ?9)",
        rusqlite::params![
            input.order_id,
            input.description,
            input.qty,
            input.unit_price,
            total,
            spec.to_string(),
            breakdown.to_string(),
            input.note,
            sort,
        ],
    )
    .map_err(|e| e.to_string())?;

    let item_id = conn.last_insert_rowid();
    recalculate_order_total(&conn, input.order_id)?;
    read_order_item(&conn, item_id)
}

#[tauri::command]
pub fn add_extra_item(db: State<DbState>, input: AddExtraItemInput) -> Result<OrderItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.qty < 1 {
        return Err("Количество должно быть >= 1".to_string());
    }

    let status = get_order_status(&conn, input.order_id)?;
    if status != "draft" && status != "in_work" {
        return Err("Добавление позиций доступно только для черновика или заказа в работе".to_string());
    }

    // Resolve name and price
    let (name, unit_price) = match (input.extra_option_type_id, &input.custom_name) {
        (Some(eid), _) => {
            let ename = catalog_name(&conn, "extra_option_types", eid);
            let price = input.unit_price.unwrap_or_else(|| {
                pricing::get_extra_default_price(&conn, eid)
                    .ok()
                    .flatten()
                    .unwrap_or(0.0)
            });
            (ename, price)
        }
        (None, Some(name)) => {
            let price = input.unit_price.unwrap_or(0.0);
            (name.clone(), price)
        }
        (None, None) => return Err("Укажите extra_option_type_id или custom_name".to_string()),
    };

    let total = unit_price * input.qty as f64;
    let spec = serde_json::json!({ "extra_name": name });
    let breakdown = serde_json::json!({
        "source": "catalog",
        "unit_price": unit_price,
        "qty": input.qty,
        "total_price": total,
    });

    let sort = next_sort_order(&conn, input.order_id)?;

    conn.execute(
        "INSERT INTO order_items (order_id, item_kind, description, qty, unit_price, total_price,
            price_source, spec_snapshot_json, price_breakdown_json, note, sort_order)
         VALUES (?1, 'extra', ?2, ?3, ?4, ?5, 'auto', ?6, ?7, ?8, ?9)",
        rusqlite::params![
            input.order_id,
            name,
            input.qty,
            unit_price,
            total,
            spec.to_string(),
            breakdown.to_string(),
            input.note,
            sort,
        ],
    )
    .map_err(|e| e.to_string())?;

    let item_id = conn.last_insert_rowid();
    recalculate_order_total(&conn, input.order_id)?;
    read_order_item(&conn, item_id)
}

#[tauri::command]
pub fn cancel_order_item(db: State<DbState>, item_id: i64) -> Result<OrderItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let item = read_order_item(&conn, item_id)?;
    let status = get_order_status(&conn, item.order_id)?;

    if status == "cancelled" {
        return Err("Заказ отменён".to_string());
    }

    if status == "draft" {
        // Hard delete in draft
        conn.execute(
            "DELETE FROM order_item_extras WHERE order_item_id = ?1",
            rusqlite::params![item_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM order_item_books WHERE order_item_id = ?1",
            rusqlite::params![item_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM order_item_prints WHERE order_item_id = ?1",
            rusqlite::params![item_id],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM order_items WHERE id = ?1",
            rusqlite::params![item_id],
        )
        .map_err(|e| e.to_string())?;

        recalculate_order_total(&conn, item.order_id)?;

        // Return the item as it was before deletion (with is_cancelled = true for clarity)
        Ok(OrderItem {
            is_cancelled: true,
            ..item
        })
    } else {
        // Soft cancel for confirmed+ orders
        conn.execute(
            "UPDATE order_items SET is_cancelled = 1, updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![item_id],
        )
        .map_err(|e| e.to_string())?;

        recalculate_order_total(&conn, item.order_id)?;

        // Cancelling may complete the order if all remaining items are done
        super::production::maybe_auto_complete_order(&conn, item.order_id)?;

        read_order_item(&conn, item_id)
    }
}

#[tauri::command]
pub fn update_order_item_price(
    db: State<DbState>,
    item_id: i64,
    input: UpdateItemPriceInput,
) -> Result<OrderItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    if input.reason.trim().is_empty() {
        return Err("Причина ручной цены обязательна".to_string());
    }

    let item = read_order_item(&conn, item_id)?;

    if item.is_cancelled {
        return Err("Нельзя изменить цену отменённой позиции".to_string());
    }

    let total = input.unit_price * item.qty as f64;
    let breakdown = serde_json::json!({
        "source": "manual",
        "unit_price": input.unit_price,
        "qty": item.qty,
        "total_price": total,
        "reason": input.reason,
    });

    conn.execute(
        "UPDATE order_items SET
            unit_price = ?1, total_price = ?2,
            price_source = 'manual', manual_price_reason = ?3,
            price_breakdown_json = ?4, updated_at = datetime('now')
         WHERE id = ?5",
        rusqlite::params![input.unit_price, total, input.reason, breakdown.to_string(), item_id],
    )
    .map_err(|e| e.to_string())?;

    recalculate_order_total(&conn, item.order_id)?;
    read_order_item(&conn, item_id)
}

#[tauri::command]
pub fn update_order_item(
    db: State<DbState>,
    item_id: i64,
    input: UpdateOrderItemInput,
) -> Result<OrderItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let item = read_order_item(&conn, item_id)?;

    if item.is_cancelled {
        return Err("Нельзя редактировать отменённую позицию".to_string());
    }

    let order_status = get_order_status(&conn, item.order_id)?;
    if order_status == "cancelled" {
        return Err("Заказ отменён".to_string());
    }

    let new_qty = input.qty.unwrap_or(item.qty);
    if new_qty < 1 {
        return Err("Количество должно быть >= 1".to_string());
    }

    let price_changed = input.unit_price.is_some();
    let new_unit_price = input.unit_price.unwrap_or(item.unit_price);
    let new_total = new_unit_price * new_qty as f64;

    // Description only for service/extra
    let new_description = if let Some(ref desc) = input.description {
        if item.item_kind != "service" && item.item_kind != "extra" {
            return Err("Описание можно менять только у услуг и доп. опций".to_string());
        }
        desc.clone()
    } else {
        item.description.clone().unwrap_or_default()
    };

    let (new_price_source, new_reason) = if price_changed {
        let reason = input.manual_price_reason.clone()
            .unwrap_or_else(|| item.manual_price_reason.clone().unwrap_or_default());
        if reason.trim().is_empty() {
            return Err("Укажите причину ручной цены".to_string());
        }
        ("manual".to_string(), Some(reason))
    } else {
        (item.price_source.clone(), item.manual_price_reason.clone())
    };

    conn.execute(
        "UPDATE order_items SET
            qty = ?1, unit_price = ?2, total_price = ?3,
            description = ?4, price_source = ?5, manual_price_reason = ?6,
            updated_at = datetime('now')
         WHERE id = ?7",
        rusqlite::params![
            new_qty, new_unit_price, new_total,
            new_description, new_price_source, new_reason,
            item_id
        ],
    )
    .map_err(|e| e.to_string())?;

    recalculate_order_total(&conn, item.order_id)?;
    read_order_item(&conn, item_id)
}

#[tauri::command]
pub fn update_order_item_note(
    db: State<DbState>,
    item_id: i64,
    note: Option<String>,
) -> Result<OrderItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let clean = note.as_deref().map(|s| s.trim()).filter(|s| !s.is_empty()).map(|s| s.to_string());
    conn.execute(
        "UPDATE order_items SET note = ?1, updated_at = datetime('now') WHERE id = ?2",
        rusqlite::params![clean, item_id],
    ).map_err(|e| e.to_string())?;
    read_order_item(&conn, item_id)
}

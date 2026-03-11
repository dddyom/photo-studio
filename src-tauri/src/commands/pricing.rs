use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;

// ── DTOs ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct PricingProgram {
    pub id: i64,
    pub name: String,
    pub is_active: bool,
    pub rules_count: i32,
    pub clients_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PricingRule {
    pub id: i64,
    pub pricing_program_id: i64,
    pub item_kind: String,
    pub match_params: String,
    pub price_formula: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CalculatedPrice {
    pub unit_price: f64,
    pub total_price: f64,
    pub breakdown_json: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateProgramInput {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProgramInput {
    pub name: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateRuleInput {
    pub pricing_program_id: i64,
    pub item_kind: String,
    pub match_params: String,
    pub price_formula: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRuleInput {
    pub match_params: Option<String>,
    pub price_formula: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct PricePreviewInput {
    pub pricing_program_id: i64,
    pub item_kind: String,
    pub spec_json: String,
    pub qty: i32,
}

// ── Program commands ─────────────────────────────────────────────────

fn read_program(conn: &Connection, id: i64) -> Result<PricingProgram, String> {
    conn.query_row(
        "SELECT p.id, p.name, p.is_active,
                (SELECT COUNT(*) FROM pricing_rules WHERE pricing_program_id = p.id) as rules_count,
                (SELECT COUNT(*) FROM clients WHERE default_pricing_program_id = p.id AND is_archived = 0) as clients_count
         FROM pricing_programs p WHERE p.id = ?1",
        rusqlite::params![id],
        |row| Ok(PricingProgram {
            id: row.get(0)?,
            name: row.get(1)?,
            is_active: row.get(2)?,
            rules_count: row.get(3)?,
            clients_count: row.get(4)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_pricing_programs(db: State<DbState>) -> Result<Vec<PricingProgram>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.name, p.is_active,
                    (SELECT COUNT(*) FROM pricing_rules WHERE pricing_program_id = p.id) as rules_count,
                    (SELECT COUNT(*) FROM clients WHERE default_pricing_program_id = p.id AND is_archived = 0) as clients_count
             FROM pricing_programs p ORDER BY p.name",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(PricingProgram {
                id: row.get(0)?,
                name: row.get(1)?,
                is_active: row.get(2)?,
                rules_count: row.get(3)?,
                clients_count: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn create_pricing_program(
    db: State<DbState>,
    input: CreateProgramInput,
) -> Result<PricingProgram, String> {
    if input.name.trim().is_empty() {
        return Err("Название программы обязательно".to_string());
    }
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO pricing_programs (name) VALUES (?1)",
        rusqlite::params![input.name.trim()],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    read_program(&conn, id)
}

#[tauri::command]
pub fn update_pricing_program(
    db: State<DbState>,
    id: i64,
    input: UpdateProgramInput,
) -> Result<PricingProgram, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Safety check: don't deactivate if used by active orders
    if input.is_active == Some(false) {
        let active_orders: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM orders WHERE pricing_program_id = ?1 AND production_status NOT IN ('closed', 'cancelled')",
                rusqlite::params![id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if active_orders > 0 {
            return Err(format!(
                "Нельзя деактивировать: {active_orders} активных заказов используют эту программу"
            ));
        }
    }

    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref name) = input.name {
        if name.trim().is_empty() {
            return Err("Название не может быть пустым".to_string());
        }
        sets.push(format!("name = ?{idx}"));
        params.push(Box::new(name.trim().to_string()));
        idx += 1;
    }
    if let Some(active) = input.is_active {
        sets.push(format!("is_active = ?{idx}"));
        params.push(Box::new(active as i32));
        idx += 1;
    }

    if sets.is_empty() {
        return Err("Нет полей для обновления".to_string());
    }

    let sql = format!(
        "UPDATE pricing_programs SET {} WHERE id = ?{idx}",
        sets.join(", ")
    );
    params.push(Box::new(id));
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;

    read_program(&conn, id)
}

// ── Rule commands ────────────────────────────────────────────────────

fn read_rule(conn: &Connection, id: i64) -> Result<PricingRule, String> {
    conn.query_row(
        "SELECT id, pricing_program_id, item_kind, match_params, price_formula, is_active
         FROM pricing_rules WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(PricingRule {
                id: row.get(0)?,
                pricing_program_id: row.get(1)?,
                item_kind: row.get(2)?,
                match_params: row.get(3)?,
                price_formula: row.get(4)?,
                is_active: row.get(5)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_pricing_rules(
    db: State<DbState>,
    pricing_program_id: i64,
) -> Result<Vec<PricingRule>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, pricing_program_id, item_kind, match_params, price_formula, is_active
             FROM pricing_rules WHERE pricing_program_id = ?1 ORDER BY item_kind, id",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![pricing_program_id], |row| {
            Ok(PricingRule {
                id: row.get(0)?,
                pricing_program_id: row.get(1)?,
                item_kind: row.get(2)?,
                match_params: row.get(3)?,
                price_formula: row.get(4)?,
                is_active: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rows)
}

#[tauri::command]
pub fn create_pricing_rule(
    db: State<DbState>,
    input: CreateRuleInput,
) -> Result<PricingRule, String> {
    let valid_kinds = ["book", "print", "service", "extra"];
    if !valid_kinds.contains(&input.item_kind.as_str()) {
        return Err(format!(
            "Тип позиции должен быть: {}",
            valid_kinds.join(", ")
        ));
    }

    // Validate JSON
    let _: serde_json::Value = serde_json::from_str(&input.match_params)
        .map_err(|_| "match_params: невалидный JSON".to_string())?;
    let formula: serde_json::Value = serde_json::from_str(&input.price_formula)
        .map_err(|_| "price_formula: невалидный JSON".to_string())?;

    // Validate formula structure
    validate_formula(&formula)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Check program exists
    let _: i64 = conn
        .query_row(
            "SELECT id FROM pricing_programs WHERE id = ?1",
            rusqlite::params![input.pricing_program_id],
            |row| row.get(0),
        )
        .map_err(|_| "Программа ценообразования не найдена".to_string())?;

    conn.execute(
        "INSERT INTO pricing_rules (pricing_program_id, item_kind, match_params, price_formula)
         VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            input.pricing_program_id,
            input.item_kind,
            input.match_params,
            input.price_formula
        ],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    read_rule(&conn, id)
}

#[tauri::command]
pub fn update_pricing_rule(
    db: State<DbState>,
    id: i64,
    input: UpdateRuleInput,
) -> Result<PricingRule, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref mp) = input.match_params {
        let _: serde_json::Value =
            serde_json::from_str(mp).map_err(|_| "match_params: невалидный JSON".to_string())?;
        sets.push(format!("match_params = ?{idx}"));
        params.push(Box::new(mp.clone()));
        idx += 1;
    }
    if let Some(ref pf) = input.price_formula {
        let formula: serde_json::Value =
            serde_json::from_str(pf).map_err(|_| "price_formula: невалидный JSON".to_string())?;
        validate_formula(&formula)?;
        sets.push(format!("price_formula = ?{idx}"));
        params.push(Box::new(pf.clone()));
        idx += 1;
    }
    if let Some(active) = input.is_active {
        sets.push(format!("is_active = ?{idx}"));
        params.push(Box::new(active as i32));
        idx += 1;
    }

    if sets.is_empty() {
        return Err("Нет полей для обновления".to_string());
    }

    let sql = format!(
        "UPDATE pricing_rules SET {} WHERE id = ?{idx}",
        sets.join(", ")
    );
    params.push(Box::new(id));
    let param_refs: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();
    let affected = conn
        .execute(&sql, param_refs.as_slice())
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Правило не найдено".to_string());
    }

    read_rule(&conn, id)
}

#[tauri::command]
pub fn delete_pricing_rule(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "DELETE FROM pricing_rules WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Правило не найдено".to_string());
    }
    Ok(())
}

// ── Price preview (exposed as Tauri command) ─────────────────────────

#[tauri::command]
pub fn preview_price(
    db: State<DbState>,
    input: PricePreviewInput,
) -> Result<CalculatedPrice, String> {
    if input.qty < 1 {
        return Err("Количество должно быть >= 1".to_string());
    }
    let spec: serde_json::Value = serde_json::from_str(&input.spec_json)
        .map_err(|_| "spec_json: невалидный JSON".to_string())?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    calculate_price(&conn, input.pricing_program_id, &input.item_kind, &spec, input.qty)
}

// ── Internal pricing logic ───────────────────────────────────────────

fn validate_formula(formula: &serde_json::Value) -> Result<(), String> {
    let formula_type = formula
        .get("type")
        .and_then(|v| v.as_str())
        .ok_or("Формула должна содержать поле 'type'")?;

    match formula_type {
        "fixed" => {
            formula
                .get("price")
                .and_then(|v| v.as_f64())
                .ok_or("Формула 'fixed': требуется числовое поле 'price'")?;
            Ok(())
        }
        "base_plus_per_unit" => {
            formula
                .get("base")
                .and_then(|v| v.as_f64())
                .ok_or("Формула 'base_plus_per_unit': требуется числовое поле 'base'")?;
            formula
                .get("per_unit")
                .and_then(|v| v.as_f64())
                .ok_or("Формула 'base_plus_per_unit': требуется числовое поле 'per_unit'")?;
            Ok(())
        }
        other => Err(format!(
            "Неизвестный тип формулы: '{other}'. Допустимые: fixed, base_plus_per_unit"
        )),
    }
}

pub fn calculate_price(
    conn: &Connection,
    pricing_program_id: i64,
    item_kind: &str,
    spec: &serde_json::Value,
    qty: i32,
) -> Result<CalculatedPrice, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, match_params, price_formula
             FROM pricing_rules
             WHERE pricing_program_id = ?1 AND item_kind = ?2 AND is_active = 1",
        )
        .map_err(|e| e.to_string())?;

    let rules: Vec<(i64, String, String)> = stmt
        .query_map(rusqlite::params![pricing_program_id, item_kind], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut best_match: Option<(i64, serde_json::Value, usize)> = None;

    for (rule_id, match_params_str, formula_str) in &rules {
        let match_params: serde_json::Value =
            serde_json::from_str(match_params_str).unwrap_or(serde_json::json!({}));
        let formula: serde_json::Value =
            serde_json::from_str(formula_str).unwrap_or(serde_json::json!({}));

        let match_obj = match_params.as_object();
        let specificity = match_obj.map_or(0, |m| m.len());

        let matches = match match_obj {
            Some(params) => params.iter().all(|(k, v)| spec.get(k) == Some(v)),
            None => true,
        };

        if matches {
            if best_match.is_none() || specificity > best_match.as_ref().unwrap().2 {
                best_match = Some((*rule_id, formula, specificity));
            }
        }
    }

    let (rule_id, formula, _) = best_match
        .ok_or_else(|| format!("Не найдено правило ценообразования для {item_kind}"))?;

    apply_formula(&formula, spec, qty, rule_id)
}

fn apply_formula(
    formula: &serde_json::Value,
    spec: &serde_json::Value,
    qty: i32,
    rule_id: i64,
) -> Result<CalculatedPrice, String> {
    let formula_type = formula
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("fixed");

    match formula_type {
        "fixed" => {
            let price = formula
                .get("price")
                .and_then(|v| v.as_f64())
                .ok_or("Формула 'fixed': отсутствует поле 'price'")?;
            let total = price * qty as f64;
            let breakdown = serde_json::json!({
                "rule_id": rule_id,
                "formula_type": "fixed",
                "unit_price": price,
                "qty": qty,
                "total_price": total,
            });
            Ok(CalculatedPrice {
                unit_price: price,
                total_price: total,
                breakdown_json: breakdown.to_string(),
            })
        }
        "base_plus_per_unit" => {
            let base = formula.get("base").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let per_unit = formula.get("per_unit").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let unit_field = formula.get("unit_field").and_then(|v| v.as_str()).unwrap_or("");

            let units = if !unit_field.is_empty() {
                spec.get(unit_field)
                    .and_then(|v| v.as_f64().or_else(|| v.as_i64().map(|i| i as f64)))
                    .unwrap_or(0.0)
            } else {
                0.0
            };

            let unit_price = base + per_unit * units;
            let total = unit_price * qty as f64;

            let breakdown = serde_json::json!({
                "rule_id": rule_id,
                "formula_type": "base_plus_per_unit",
                "base": base,
                "per_unit": per_unit,
                "unit_field": unit_field,
                "units": units,
                "unit_price": unit_price,
                "qty": qty,
                "total_price": total,
            });
            Ok(CalculatedPrice {
                unit_price,
                total_price: total,
                breakdown_json: breakdown.to_string(),
            })
        }
        other => Err(format!("Неизвестный тип формулы: {other}")),
    }
}

/// Composite book pricing: block (per spread) + cover + cover options.
/// Falls back to regular calculate_price if no component rules found.
pub fn calculate_book_price(
    conn: &Connection,
    pricing_program_id: i64,
    spec: &serde_json::Value,
    qty: i32,
) -> Result<CalculatedPrice, String> {
    let format = spec.get("format").and_then(|v| v.as_str()).unwrap_or("");
    let assembly_kind = spec.get("assembly_kind").and_then(|v| v.as_str()).unwrap_or("");
    let spread_count = spec.get("spread_count")
        .and_then(|v| v.as_f64().or_else(|| v.as_i64().map(|i| i as f64)))
        .unwrap_or(0.0);
    let cover_family = spec.get("cover_family").and_then(|v| v.as_str()).unwrap_or("");
    let cover_options: Vec<String> = spec.get("cover_options")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
        .unwrap_or_default();

    // If assembly_kind is empty, fall back to legacy calculate_price
    if assembly_kind.is_empty() {
        return calculate_price(conn, pricing_program_id, "book", spec, qty);
    }

    // 1. Block price (per spread)
    let block_spec = serde_json::json!({
        "component": "block",
        "assembly_kind": assembly_kind,
        "format": format,
    });
    let block_calc = calculate_price(conn, pricing_program_id, "book", &block_spec, 1)?;
    let block_per_spread = block_calc.unit_price;
    let block_total = block_per_spread * spread_count;

    // 2. Cover price
    let mut cover_price = 0.0;
    let mut cover_breakdown = serde_json::json!(null);
    if !cover_family.is_empty() {
        let cover_spec = serde_json::json!({
            "component": "cover",
            "cover_family": cover_family,
            "format": format,
        });
        let cover_calc = calculate_price(conn, pricing_program_id, "book", &cover_spec, 1)?;
        cover_price = cover_calc.unit_price;
        cover_breakdown = serde_json::json!({
            "cover_family": cover_family,
            "format": format,
            "price": cover_price,
        });
    }

    // 3. Cover options
    let mut options_breakdown = Vec::new();
    let mut options_total = 0.0;
    for option in &cover_options {
        let opt_spec = serde_json::json!({
            "component": "cover_option",
            "option_name": option,
        });
        match calculate_price(conn, pricing_program_id, "book", &opt_spec, 1) {
            Ok(opt_calc) => {
                options_total += opt_calc.unit_price;
                options_breakdown.push(serde_json::json!({
                    "option": option,
                    "price": opt_calc.unit_price,
                }));
            }
            Err(_) => {
                // Option rule not found — skip silently
            }
        }
    }

    // 4. Compose
    let unit_price = block_total + cover_price + options_total;
    let total_price = unit_price * qty as f64;

    let breakdown = serde_json::json!({
        "formula_type": "book_composite",
        "block": {
            "assembly_kind": assembly_kind,
            "format": format,
            "per_spread": block_per_spread,
            "spread_count": spread_count,
            "total": block_total,
        },
        "cover": cover_breakdown,
        "cover_options": options_breakdown,
        "options_total": options_total,
        "unit_price": unit_price,
        "qty": qty,
        "total_price": total_price,
    });

    Ok(CalculatedPrice {
        unit_price,
        total_price,
        breakdown_json: breakdown.to_string(),
    })
}

pub fn get_extra_default_price(
    conn: &Connection,
    extra_option_type_id: i64,
) -> Result<Option<f64>, String> {
    conn.query_row(
        "SELECT default_price FROM extra_option_types WHERE id = ?1",
        rusqlite::params![extra_option_type_id],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

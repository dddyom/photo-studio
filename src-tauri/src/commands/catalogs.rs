use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::DbState;

// ── DTOs ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CatalogItem {
    pub id: i64,
    pub name: String,
    pub is_active: bool,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtraOptionType {
    pub id: i64,
    pub name: String,
    pub default_price: Option<f64>,
    pub is_active: bool,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaterialItem {
    pub id: i64,
    pub name: String,
    pub category: String,
    pub is_active: bool,
    pub sort_order: i32,
}

#[derive(Debug, Deserialize)]
pub struct CreateCatalogInput {
    pub name: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCatalogInput {
    pub name: Option<String>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMaterialInput {
    pub name: String,
    pub category: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreateExtraOptionInput {
    pub name: String,
    pub default_price: Option<f64>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateExtraOptionInput {
    pub name: Option<String>,
    pub default_price: Option<f64>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

// ── Generic catalog macros ───────────────────────────────────────────

macro_rules! catalog_crud {
    ($list_fn:ident, $list_all_fn:ident, $create_fn:ident, $update_fn:ident, $table:literal) => {
        #[tauri::command]
        pub fn $list_fn(db: State<DbState>) -> Result<Vec<CatalogItem>, String> {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            let mut stmt = conn
                .prepare(concat!(
                    "SELECT id, name, is_active, sort_order FROM ", $table,
                    " WHERE is_active = 1 ORDER BY sort_order, name"
                ))
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok(CatalogItem {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        is_active: row.get(2)?,
                        sort_order: row.get(3)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            Ok(rows)
        }

        #[tauri::command]
        pub fn $list_all_fn(db: State<DbState>) -> Result<Vec<CatalogItem>, String> {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            let mut stmt = conn
                .prepare(concat!(
                    "SELECT id, name, is_active, sort_order FROM ", $table,
                    " ORDER BY sort_order, name"
                ))
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok(CatalogItem {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        is_active: row.get(2)?,
                        sort_order: row.get(3)?,
                    })
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;
            Ok(rows)
        }

        #[tauri::command]
        pub fn $create_fn(db: State<DbState>, input: CreateCatalogInput) -> Result<CatalogItem, String> {
            if input.name.trim().is_empty() {
                return Err("Название не может быть пустым".to_string());
            }
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            conn.execute(
                concat!("INSERT INTO ", $table, " (name, sort_order) VALUES (?1, ?2)"),
                rusqlite::params![input.name.trim(), input.sort_order.unwrap_or(0)],
            )
            .map_err(|e| {
                if e.to_string().contains("UNIQUE") {
                    format!("Запись '{}' уже существует", input.name)
                } else {
                    e.to_string()
                }
            })?;
            let id = conn.last_insert_rowid();
            conn.query_row(
                concat!("SELECT id, name, is_active, sort_order FROM ", $table, " WHERE id = ?1"),
                rusqlite::params![id],
                |row| Ok(CatalogItem {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    is_active: row.get(2)?,
                    sort_order: row.get(3)?,
                }),
            )
            .map_err(|e| e.to_string())
        }

        #[tauri::command]
        pub fn $update_fn(db: State<DbState>, id: i64, input: UpdateCatalogInput) -> Result<CatalogItem, String> {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
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
            if let Some(order) = input.sort_order {
                sets.push(format!("sort_order = ?{idx}"));
                params.push(Box::new(order));
                idx += 1;
            }

            if sets.is_empty() {
                return Err("Нет полей для обновления".to_string());
            }

            let sql = format!(
                concat!("UPDATE ", $table, " SET {} WHERE id = ?{}"),
                sets.join(", "),
                idx,
            );
            params.push(Box::new(id));
            let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
            let affected = conn.execute(&sql, param_refs.as_slice()).map_err(|e| {
                if e.to_string().contains("UNIQUE") {
                    "Запись с таким названием уже существует".to_string()
                } else {
                    e.to_string()
                }
            })?;
            if affected == 0 {
                return Err("Запись не найдена".to_string());
            }

            conn.query_row(
                concat!("SELECT id, name, is_active, sort_order FROM ", $table, " WHERE id = ?1"),
                rusqlite::params![id],
                |row| Ok(CatalogItem {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    is_active: row.get(2)?,
                    sort_order: row.get(3)?,
                }),
            )
            .map_err(|e| e.to_string())
        }
    };
}

catalog_crud!(list_book_formats, list_all_book_formats, create_book_format, update_book_format, "book_formats");
catalog_crud!(list_print_formats, list_all_print_formats, create_print_format, update_print_format, "print_formats");
catalog_crud!(list_cover_types, list_all_cover_types, create_cover_type, update_cover_type, "cover_types");
catalog_crud!(list_cover_materials, list_all_cover_materials, create_cover_material, update_cover_material, "cover_materials");
catalog_crud!(list_lamination_types, list_all_lamination_types, create_lamination_type, update_lamination_type, "lamination_types");

// ── Materials (with category) ────────────────────────────────────────

fn list_materials_by_category(
    conn: &std::sync::MutexGuard<rusqlite::Connection>,
    category: &str,
    all: bool,
) -> Result<Vec<MaterialItem>, String> {
    let filter = if all { "" } else { " AND is_active = 1" };
    let sql = format!(
        "SELECT id, name, category, is_active, sort_order FROM materials WHERE category = ?1{filter} ORDER BY sort_order, name"
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![category], |row| {
            Ok(MaterialItem {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                is_active: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn list_block_materials(db: State<DbState>) -> Result<Vec<CatalogItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    Ok(list_materials_by_category(&conn, "block", false)?
        .into_iter()
        .map(|m| CatalogItem { id: m.id, name: m.name, is_active: m.is_active, sort_order: m.sort_order })
        .collect())
}

#[tauri::command]
pub fn list_print_materials(db: State<DbState>) -> Result<Vec<CatalogItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    Ok(list_materials_by_category(&conn, "print", false)?
        .into_iter()
        .map(|m| CatalogItem { id: m.id, name: m.name, is_active: m.is_active, sort_order: m.sort_order })
        .collect())
}

#[tauri::command]
pub fn list_finishing_materials(db: State<DbState>) -> Result<Vec<CatalogItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    Ok(list_materials_by_category(&conn, "finishing", false)?
        .into_iter()
        .map(|m| CatalogItem { id: m.id, name: m.name, is_active: m.is_active, sort_order: m.sort_order })
        .collect())
}

#[tauri::command]
pub fn list_all_materials(db: State<DbState>) -> Result<Vec<MaterialItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, category, is_active, sort_order FROM materials ORDER BY category, sort_order, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(MaterialItem {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                is_active: row.get(3)?,
                sort_order: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn create_material(db: State<DbState>, input: CreateMaterialInput) -> Result<MaterialItem, String> {
    if input.name.trim().is_empty() {
        return Err("Название не может быть пустым".to_string());
    }
    let valid_cats = ["block", "print", "finishing"];
    if !valid_cats.contains(&input.category.as_str()) {
        return Err(format!("Категория должна быть: {}", valid_cats.join(", ")));
    }
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO materials (name, category, sort_order) VALUES (?1, ?2, ?3)",
        rusqlite::params![input.name.trim(), input.category, input.sort_order.unwrap_or(0)],
    )
    .map_err(|e| e.to_string())?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, category, is_active, sort_order FROM materials WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(MaterialItem {
            id: row.get(0)?,
            name: row.get(1)?,
            category: row.get(2)?,
            is_active: row.get(3)?,
            sort_order: row.get(4)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_material(db: State<DbState>, id: i64, input: UpdateCatalogInput) -> Result<MaterialItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
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
    if let Some(order) = input.sort_order {
        sets.push(format!("sort_order = ?{idx}"));
        params.push(Box::new(order));
        idx += 1;
    }

    if sets.is_empty() {
        return Err("Нет полей для обновления".to_string());
    }

    let sql = format!("UPDATE materials SET {} WHERE id = ?{idx}", sets.join(", "));
    params.push(Box::new(id));
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice()).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, name, category, is_active, sort_order FROM materials WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(MaterialItem {
            id: row.get(0)?,
            name: row.get(1)?,
            category: row.get(2)?,
            is_active: row.get(3)?,
            sort_order: row.get(4)?,
        }),
    )
    .map_err(|e| e.to_string())
}

// ── Extra option types ───────────────────────────────────────────────

#[tauri::command]
pub fn list_extra_option_types(db: State<DbState>) -> Result<Vec<ExtraOptionType>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, default_price, is_active, sort_order FROM extra_option_types WHERE is_active = 1 ORDER BY sort_order, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ExtraOptionType { id: row.get(0)?, name: row.get(1)?, default_price: row.get(2)?, is_active: row.get(3)?, sort_order: row.get(4)? })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn list_all_extra_option_types(db: State<DbState>) -> Result<Vec<ExtraOptionType>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, default_price, is_active, sort_order FROM extra_option_types ORDER BY sort_order, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ExtraOptionType { id: row.get(0)?, name: row.get(1)?, default_price: row.get(2)?, is_active: row.get(3)?, sort_order: row.get(4)? })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn create_extra_option_type(db: State<DbState>, input: CreateExtraOptionInput) -> Result<ExtraOptionType, String> {
    if input.name.trim().is_empty() {
        return Err("Название не может быть пустым".to_string());
    }
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO extra_option_types (name, default_price, sort_order) VALUES (?1, ?2, ?3)",
        rusqlite::params![input.name.trim(), input.default_price, input.sort_order.unwrap_or(0)],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") { format!("'{}' уже существует", input.name) } else { e.to_string() }
    })?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, default_price, is_active, sort_order FROM extra_option_types WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(ExtraOptionType { id: row.get(0)?, name: row.get(1)?, default_price: row.get(2)?, is_active: row.get(3)?, sort_order: row.get(4)? }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_extra_option_type(db: State<DbState>, id: i64, input: UpdateExtraOptionInput) -> Result<ExtraOptionType, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref name) = input.name {
        if name.trim().is_empty() { return Err("Название не может быть пустым".to_string()); }
        sets.push(format!("name = ?{idx}")); params.push(Box::new(name.trim().to_string())); idx += 1;
    }
    if let Some(price) = input.default_price {
        sets.push(format!("default_price = ?{idx}")); params.push(Box::new(price)); idx += 1;
    }
    if let Some(active) = input.is_active {
        sets.push(format!("is_active = ?{idx}")); params.push(Box::new(active as i32)); idx += 1;
    }
    if let Some(order) = input.sort_order {
        sets.push(format!("sort_order = ?{idx}")); params.push(Box::new(order)); idx += 1;
    }
    if sets.is_empty() { return Err("Нет полей для обновления".to_string()); }

    let sql = format!("UPDATE extra_option_types SET {} WHERE id = ?{idx}", sets.join(", "));
    params.push(Box::new(id));
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, param_refs.as_slice()).map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, name, default_price, is_active, sort_order FROM extra_option_types WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(ExtraOptionType { id: row.get(0)?, name: row.get(1)?, default_price: row.get(2)?, is_active: row.get(3)?, sort_order: row.get(4)? }),
    )
    .map_err(|e| e.to_string())
}

// ── Company accounts (read-only for now) ─────────────────────────────

#[tauri::command]
pub fn list_company_accounts(db: State<DbState>) -> Result<Vec<CatalogItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, 1 as is_active, 0 as sort_order FROM company_accounts WHERE is_active = 1 ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(CatalogItem { id: row.get(0)?, name: row.get(1)?, is_active: row.get(2)?, sort_order: row.get(3)? })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

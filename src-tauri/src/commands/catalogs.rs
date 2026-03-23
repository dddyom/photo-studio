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

#[derive(Debug, Serialize, Deserialize)]
pub struct CodeCatalogItem {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub is_active: bool,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PrintCategoryItem {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub unit: String,
    pub field_type: String,
    pub is_active: bool,
    pub sort_order: i32,
    pub has_printing: bool,
    pub has_assembly: bool,
}

#[derive(Debug, Deserialize)]
pub struct CreateCodeCatalogInput {
    pub code: String,
    pub name: String,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCodeCatalogInput {
    pub code: Option<String>,
    pub name: Option<String>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePrintCategoryInput {
    pub code: String,
    pub name: String,
    pub unit: Option<String>,
    pub field_type: Option<String>,
    pub sort_order: Option<i32>,
    pub has_printing: Option<bool>,
    pub has_assembly: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePrintCategoryInput {
    pub code: Option<String>,
    pub name: Option<String>,
    pub unit: Option<String>,
    pub field_type: Option<String>,
    pub is_active: Option<bool>,
    pub sort_order: Option<i32>,
    pub has_printing: Option<bool>,
    pub has_assembly: Option<bool>,
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
    ($list_fn:ident, $list_all_fn:ident, $create_fn:ident, $update_fn:ident, $delete_fn:ident, $table:literal) => {
        #[tauri::command]
        #[allow(dead_code)]
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
        #[allow(dead_code)]
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

        #[tauri::command]
        pub fn $delete_fn(db: State<DbState>, id: i64) -> Result<(), String> {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            let affected = conn
                .execute(concat!("DELETE FROM ", $table, " WHERE id = ?1"), rusqlite::params![id])
                .map_err(|e| {
                    if e.to_string().contains("FOREIGN KEY") {
                        "Невозможно удалить: запись используется в других данных".to_string()
                    } else {
                        e.to_string()
                    }
                })?;
            if affected == 0 {
                return Err("Запись не найдена".to_string());
            }
            Ok(())
        }
    };
}

catalog_crud!(list_book_formats, list_all_book_formats, create_book_format, update_book_format, delete_book_format, "book_formats");
catalog_crud!(list_print_formats, list_all_print_formats, create_print_format, update_print_format, delete_print_format, "print_formats");
catalog_crud!(list_cover_types, list_all_cover_types, create_cover_type, update_cover_type, delete_cover_type, "cover_types");
catalog_crud!(list_cover_materials, list_all_cover_materials, create_cover_material, update_cover_material, delete_cover_material, "cover_materials");
catalog_crud!(list_lamination_types, list_all_lamination_types, create_lamination_type, update_lamination_type, delete_lamination_type, "lamination_types");

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

#[tauri::command]
pub fn delete_material(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM materials WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| {
            if e.to_string().contains("FOREIGN KEY") {
                "Невозможно удалить: материал используется".to_string()
            } else {
                e.to_string()
            }
        })?;
    if affected == 0 {
        return Err("Запись не найдена".to_string());
    }
    Ok(())
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

#[tauri::command]
pub fn delete_extra_option_type(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM extra_option_types WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| {
            if e.to_string().contains("FOREIGN KEY") {
                "Невозможно удалить: опция используется".to_string()
            } else {
                e.to_string()
            }
        })?;
    if affected == 0 {
        return Err("Запись не найдена".to_string());
    }
    Ok(())
}

// ── Simple catalogs (v10): book_cover_options, wide_format_materials ─

// list/list_all for book_cover_options are hand-written below (with cover_family_code)
catalog_crud!(list_book_cover_options_base, list_all_book_cover_options_base, create_book_cover_option, update_book_cover_option, delete_book_cover_option, "book_cover_options");
catalog_crud!(list_wide_format_materials, list_all_wide_format_materials, create_wide_format_material, update_wide_format_material, delete_wide_format_material, "wide_format_materials");

// ── Code-based catalogs: assembly_kinds, cover_families ─────────────

macro_rules! code_catalog_crud {
    ($list_fn:ident, $list_all_fn:ident, $create_fn:ident, $update_fn:ident, $delete_fn:ident, $table:literal) => {
        #[tauri::command]
        #[allow(dead_code)]
        pub fn $list_fn(db: State<DbState>) -> Result<Vec<CodeCatalogItem>, String> {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            let mut stmt = conn
                .prepare(concat!(
                    "SELECT id, code, name, is_active, sort_order FROM ", $table,
                    " WHERE is_active = 1 ORDER BY sort_order, name"
                ))
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok(CodeCatalogItem {
                        id: row.get(0)?,
                        code: row.get(1)?,
                        name: row.get(2)?,
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
        #[allow(dead_code)]
        pub fn $list_all_fn(db: State<DbState>) -> Result<Vec<CodeCatalogItem>, String> {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            let mut stmt = conn
                .prepare(concat!(
                    "SELECT id, code, name, is_active, sort_order FROM ", $table,
                    " ORDER BY sort_order, name"
                ))
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map([], |row| {
                    Ok(CodeCatalogItem {
                        id: row.get(0)?,
                        code: row.get(1)?,
                        name: row.get(2)?,
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
        pub fn $create_fn(db: State<DbState>, input: CreateCodeCatalogInput) -> Result<CodeCatalogItem, String> {
            if input.code.trim().is_empty() {
                return Err("Код не может быть пустым".to_string());
            }
            if input.name.trim().is_empty() {
                return Err("Название не может быть пустым".to_string());
            }
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            conn.execute(
                concat!("INSERT INTO ", $table, " (code, name, sort_order) VALUES (?1, ?2, ?3)"),
                rusqlite::params![input.code.trim(), input.name.trim(), input.sort_order.unwrap_or(0)],
            )
            .map_err(|e| {
                if e.to_string().contains("UNIQUE") {
                    format!("Запись с кодом '{}' уже существует", input.code)
                } else {
                    e.to_string()
                }
            })?;
            let id = conn.last_insert_rowid();
            conn.query_row(
                concat!("SELECT id, code, name, is_active, sort_order FROM ", $table, " WHERE id = ?1"),
                rusqlite::params![id],
                |row| Ok(CodeCatalogItem {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    name: row.get(2)?,
                    is_active: row.get(3)?,
                    sort_order: row.get(4)?,
                }),
            )
            .map_err(|e| e.to_string())
        }

        #[tauri::command]
        pub fn $update_fn(db: State<DbState>, id: i64, input: UpdateCodeCatalogInput) -> Result<CodeCatalogItem, String> {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            let mut sets: Vec<String> = Vec::new();
            let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
            let mut idx = 1;

            if let Some(ref code) = input.code {
                if code.trim().is_empty() { return Err("Код не может быть пустым".to_string()); }
                sets.push(format!("code = ?{idx}")); params.push(Box::new(code.trim().to_string())); idx += 1;
            }
            if let Some(ref name) = input.name {
                if name.trim().is_empty() { return Err("Название не может быть пустым".to_string()); }
                sets.push(format!("name = ?{idx}")); params.push(Box::new(name.trim().to_string())); idx += 1;
            }
            if let Some(active) = input.is_active {
                sets.push(format!("is_active = ?{idx}")); params.push(Box::new(active as i32)); idx += 1;
            }
            if let Some(order) = input.sort_order {
                sets.push(format!("sort_order = ?{idx}")); params.push(Box::new(order)); idx += 1;
            }
            if sets.is_empty() { return Err("Нет полей для обновления".to_string()); }

            let sql = format!(concat!("UPDATE ", $table, " SET {} WHERE id = ?{}"), sets.join(", "), idx);
            params.push(Box::new(id));
            let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
            let affected = conn.execute(&sql, param_refs.as_slice()).map_err(|e| {
                if e.to_string().contains("UNIQUE") { "Запись с таким кодом уже существует".to_string() } else { e.to_string() }
            })?;
            if affected == 0 { return Err("Запись не найдена".to_string()); }

            conn.query_row(
                concat!("SELECT id, code, name, is_active, sort_order FROM ", $table, " WHERE id = ?1"),
                rusqlite::params![id],
                |row| Ok(CodeCatalogItem {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    name: row.get(2)?,
                    is_active: row.get(3)?,
                    sort_order: row.get(4)?,
                }),
            )
            .map_err(|e| e.to_string())
        }

        #[tauri::command]
        pub fn $delete_fn(db: State<DbState>, id: i64) -> Result<(), String> {
            let conn = db.conn.lock().map_err(|e| e.to_string())?;
            let affected = conn
                .execute(concat!("DELETE FROM ", $table, " WHERE id = ?1"), rusqlite::params![id])
                .map_err(|e| {
                    if e.to_string().contains("FOREIGN KEY") {
                        "Невозможно удалить: запись используется в других данных".to_string()
                    } else {
                        e.to_string()
                    }
                })?;
            if affected == 0 {
                return Err("Запись не найдена".to_string());
            }
            Ok(())
        }
    };
}

code_catalog_crud!(list_assembly_kinds, list_all_assembly_kinds, create_assembly_kind, update_assembly_kind, delete_assembly_kind, "assembly_kinds");
code_catalog_crud!(list_cover_families_base, list_all_cover_families_base, create_cover_family, update_cover_family, delete_cover_family, "cover_families");

// ── Cover families ──────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct CoverFamilyItem {
    pub id: i64,
    pub code: String,
    pub name: String,
    pub is_active: bool,
    pub sort_order: i32,
}

fn query_cover_families(conn: &rusqlite::Connection, active_only: bool) -> Result<Vec<CoverFamilyItem>, String> {
    let sql = if active_only {
        "SELECT id, code, name, is_active, sort_order FROM cover_families WHERE is_active = 1 ORDER BY sort_order, name"
    } else {
        "SELECT id, code, name, is_active, sort_order FROM cover_families ORDER BY sort_order, name"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(CoverFamilyItem {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
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
pub fn list_cover_families(db: State<DbState>) -> Result<Vec<CoverFamilyItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query_cover_families(&conn, true)
}

#[tauri::command]
pub fn list_all_cover_families(db: State<DbState>) -> Result<Vec<CoverFamilyItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query_cover_families(&conn, false)
}

// ── Book cover options with family scoping via join table ────────────

#[derive(Debug, Serialize)]
pub struct BookCoverOptionItem {
    pub id: i64,
    pub name: String,
    pub is_active: bool,
    pub sort_order: i32,
    pub cover_family_codes: Vec<String>,
}

fn query_book_cover_options(conn: &rusqlite::Connection, active_only: bool) -> Result<Vec<BookCoverOptionItem>, String> {
    let sql = if active_only {
        "SELECT id, name, is_active, sort_order FROM book_cover_options WHERE is_active = 1 ORDER BY sort_order, name"
    } else {
        "SELECT id, name, is_active, sort_order FROM book_cover_options ORDER BY sort_order, name"
    };
    let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
    let mut options: Vec<BookCoverOptionItem> = stmt
        .query_map([], |row| {
            Ok(BookCoverOptionItem {
                id: row.get(0)?, name: row.get(1)?, is_active: row.get(2)?,
                sort_order: row.get(3)?, cover_family_codes: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Load family codes from join table (fall back to legacy cover_family_code column)
    let has_join_table: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name='cover_option_families'",
            [], |r| r.get(0),
        )
        .unwrap_or(false);

    if has_join_table {
        let mut fam_stmt = conn
            .prepare("SELECT cover_option_id, cover_family_code FROM cover_option_families ORDER BY cover_option_id")
            .map_err(|e| e.to_string())?;
        let families: Vec<(i64, String)> = fam_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        for opt in &mut options {
            opt.cover_family_codes = families.iter()
                .filter(|(oid, _)| *oid == opt.id)
                .map(|(_, code)| code.clone())
                .collect();
        }
    } else {
        // Legacy: read from cover_family_code column directly
        let mut legacy_stmt = conn
            .prepare("SELECT id, cover_family_code FROM book_cover_options WHERE cover_family_code IS NOT NULL")
            .map_err(|e| e.to_string())?;
        let legacy: Vec<(i64, String)> = legacy_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        for opt in &mut options {
            if let Some((_, code)) = legacy.iter().find(|(id, _)| *id == opt.id) {
                opt.cover_family_codes = vec![code.clone()];
            }
        }
    }

    Ok(options)
}

#[tauri::command]
pub fn list_book_cover_options(db: State<DbState>) -> Result<Vec<BookCoverOptionItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query_book_cover_options(&conn, true)
}

#[tauri::command]
pub fn list_all_book_cover_options(db: State<DbState>) -> Result<Vec<BookCoverOptionItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query_book_cover_options(&conn, false)
}

// ── Set cover option ↔ family associations ──────────────────────────

#[derive(Debug, Deserialize)]
pub struct SetCoverOptionFamiliesInput {
    pub cover_option_id: i64,
    pub cover_family_codes: Vec<String>,
}

#[tauri::command]
pub fn set_cover_option_families(
    db: State<DbState>,
    input: SetCoverOptionFamiliesInput,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Ensure join table exists
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS cover_option_families (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            cover_option_id     INTEGER NOT NULL REFERENCES book_cover_options(id) ON DELETE CASCADE,
            cover_family_code   TEXT    NOT NULL,
            UNIQUE(cover_option_id, cover_family_code)
        )"
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM cover_option_families WHERE cover_option_id = ?1",
        rusqlite::params![input.cover_option_id],
    ).map_err(|e| e.to_string())?;

    for code in &input.cover_family_codes {
        conn.execute(
            "INSERT INTO cover_option_families (cover_option_id, cover_family_code) VALUES (?1, ?2)",
            rusqlite::params![input.cover_option_id, code],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// ── Print categories ────────────────────────────────────────────────

#[tauri::command]
pub fn list_print_categories(db: State<DbState>) -> Result<Vec<PrintCategoryItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, code, name, unit, field_type, is_active, sort_order, has_printing, has_assembly FROM print_categories WHERE is_active = 1 ORDER BY sort_order, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(PrintCategoryItem {
                id: row.get(0)?, code: row.get(1)?, name: row.get(2)?,
                unit: row.get(3)?, field_type: row.get(4)?,
                is_active: row.get(5)?, sort_order: row.get(6)?,
                has_printing: row.get(7)?, has_assembly: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn list_all_print_categories(db: State<DbState>) -> Result<Vec<PrintCategoryItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, code, name, unit, field_type, is_active, sort_order, has_printing, has_assembly FROM print_categories ORDER BY sort_order, name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(PrintCategoryItem {
                id: row.get(0)?, code: row.get(1)?, name: row.get(2)?,
                unit: row.get(3)?, field_type: row.get(4)?,
                is_active: row.get(5)?, sort_order: row.get(6)?,
                has_printing: row.get(7)?, has_assembly: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub fn create_print_category(db: State<DbState>, input: CreatePrintCategoryInput) -> Result<PrintCategoryItem, String> {
    if input.code.trim().is_empty() { return Err("Код не может быть пустым".to_string()); }
    if input.name.trim().is_empty() { return Err("Название не может быть пустым".to_string()); }
    let valid_field_types = ["format", "material", "lamination"];
    let field_type = input.field_type.as_deref().unwrap_or("format");
    if !valid_field_types.contains(&field_type) {
        return Err(format!("Тип поля должен быть: {}", valid_field_types.join(", ")));
    }
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO print_categories (code, name, unit, field_type, sort_order, has_printing, has_assembly) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            input.code.trim(), input.name.trim(),
            input.unit.as_deref().unwrap_or("шт."), field_type,
            input.sort_order.unwrap_or(0),
            input.has_printing.unwrap_or(true) as i32,
            input.has_assembly.unwrap_or(false) as i32
        ],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") { format!("Категория с кодом '{}' уже существует", input.code) } else { e.to_string() }
    })?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, code, name, unit, field_type, is_active, sort_order, has_printing, has_assembly FROM print_categories WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(PrintCategoryItem {
            id: row.get(0)?, code: row.get(1)?, name: row.get(2)?,
            unit: row.get(3)?, field_type: row.get(4)?,
            is_active: row.get(5)?, sort_order: row.get(6)?,
            has_printing: row.get(7)?, has_assembly: row.get(8)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_print_category(db: State<DbState>, id: i64, input: UpdatePrintCategoryInput) -> Result<PrintCategoryItem, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref code) = input.code {
        if code.trim().is_empty() { return Err("Код не может быть пустым".to_string()); }
        sets.push(format!("code = ?{idx}")); params.push(Box::new(code.trim().to_string())); idx += 1;
    }
    if let Some(ref name) = input.name {
        if name.trim().is_empty() { return Err("Название не может быть пустым".to_string()); }
        sets.push(format!("name = ?{idx}")); params.push(Box::new(name.trim().to_string())); idx += 1;
    }
    if let Some(ref unit) = input.unit {
        sets.push(format!("unit = ?{idx}")); params.push(Box::new(unit.clone())); idx += 1;
    }
    if let Some(ref field_type) = input.field_type {
        let valid = ["format", "material", "lamination"];
        if !valid.contains(&field_type.as_str()) {
            return Err(format!("Тип поля должен быть: {}", valid.join(", ")));
        }
        sets.push(format!("field_type = ?{idx}")); params.push(Box::new(field_type.clone())); idx += 1;
    }
    if let Some(active) = input.is_active {
        sets.push(format!("is_active = ?{idx}")); params.push(Box::new(active as i32)); idx += 1;
    }
    if let Some(order) = input.sort_order {
        sets.push(format!("sort_order = ?{idx}")); params.push(Box::new(order)); idx += 1;
    }
    if let Some(hp) = input.has_printing {
        sets.push(format!("has_printing = ?{idx}")); params.push(Box::new(hp as i32)); idx += 1;
    }
    if let Some(ha) = input.has_assembly {
        sets.push(format!("has_assembly = ?{idx}")); params.push(Box::new(ha as i32)); idx += 1;
    }
    if sets.is_empty() { return Err("Нет полей для обновления".to_string()); }

    let sql = format!("UPDATE print_categories SET {} WHERE id = ?{idx}", sets.join(", "));
    params.push(Box::new(id));
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let affected = conn.execute(&sql, param_refs.as_slice()).map_err(|e| {
        if e.to_string().contains("UNIQUE") { "Категория с таким кодом уже существует".to_string() } else { e.to_string() }
    })?;
    if affected == 0 { return Err("Запись не найдена".to_string()); }

    conn.query_row(
        "SELECT id, code, name, unit, field_type, is_active, sort_order, has_printing, has_assembly FROM print_categories WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(PrintCategoryItem {
            id: row.get(0)?, code: row.get(1)?, name: row.get(2)?,
            unit: row.get(3)?, field_type: row.get(4)?,
            is_active: row.get(5)?, sort_order: row.get(6)?,
            has_printing: row.get(7)?, has_assembly: row.get(8)?,
        }),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_print_category(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn
        .execute("DELETE FROM print_categories WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| {
            if e.to_string().contains("FOREIGN KEY") {
                "Невозможно удалить: категория используется".to_string()
            } else {
                e.to_string()
            }
        })?;
    if affected == 0 {
        return Err("Запись не найдена".to_string());
    }
    Ok(())
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

// ── Format popularity ───────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct FormatPopularity {
    pub name: String,
    pub count: i64,
}

/// Returns print format names ordered by usage count (descending).
#[tauri::command]
pub fn popular_print_formats(db: State<DbState>) -> Result<Vec<FormatPopularity>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT pf.name, COUNT(oip.id) AS cnt
             FROM order_item_prints oip
             JOIN print_formats pf ON pf.id = oip.print_format_id
             JOIN order_items oi ON oi.id = oip.order_item_id
             WHERE oi.is_cancelled = 0
             GROUP BY pf.name
             ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FormatPopularity { name: row.get(0)?, count: row.get(1)? })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

/// Returns book format names ordered by usage count (descending).
#[tauri::command]
pub fn popular_book_formats(db: State<DbState>) -> Result<Vec<FormatPopularity>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT bf.name, COUNT(oib.id) AS cnt
             FROM order_item_books oib
             JOIN book_formats bf ON bf.id = oib.book_format_id
             JOIN order_items oi ON oi.id = oib.order_item_id
             WHERE oi.is_cancelled = 0
             GROUP BY bf.name
             ORDER BY cnt DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(FormatPopularity { name: row.get(0)?, count: row.get(1)? })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

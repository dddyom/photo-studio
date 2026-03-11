mod commands;
mod db;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize database
            let db_state = db::init_db(app.handle())
                .expect("Failed to initialize database");

            // Run seed data
            {
                let conn = db_state.conn.lock().unwrap();
                db::seed::run(&conn).expect("Failed to seed data");
            }

            app.manage(db_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // System
            commands::system::get_db_info,
            commands::system::get_settings,
            commands::system::update_setting,
            commands::system::seed_demo_data,
            commands::system::create_backup,
            commands::system::list_backups,
            commands::system::restore_backup,
            commands::system::delete_backup,
            commands::system::export_orders_csv,
            commands::system::export_transactions_csv,
            commands::system::export_partner_settlements_csv,
            // Clients
            commands::clients::list_clients,
            commands::clients::get_client,
            commands::clients::create_client,
            commands::clients::update_client,
            commands::clients::list_all_clients,
            commands::clients::archive_client,
            commands::clients::unarchive_client,
            commands::clients::delete_client,
            // Catalogs
            commands::catalogs::list_book_formats,
            commands::catalogs::list_all_book_formats,
            commands::catalogs::create_book_format,
            commands::catalogs::update_book_format,
            commands::catalogs::delete_book_format,
            commands::catalogs::list_print_formats,
            commands::catalogs::list_all_print_formats,
            commands::catalogs::create_print_format,
            commands::catalogs::update_print_format,
            commands::catalogs::delete_print_format,
            commands::catalogs::list_cover_types,
            commands::catalogs::list_all_cover_types,
            commands::catalogs::create_cover_type,
            commands::catalogs::update_cover_type,
            commands::catalogs::delete_cover_type,
            commands::catalogs::list_cover_materials,
            commands::catalogs::list_all_cover_materials,
            commands::catalogs::create_cover_material,
            commands::catalogs::update_cover_material,
            commands::catalogs::delete_cover_material,
            commands::catalogs::list_lamination_types,
            commands::catalogs::list_all_lamination_types,
            commands::catalogs::create_lamination_type,
            commands::catalogs::update_lamination_type,
            commands::catalogs::delete_lamination_type,
            commands::catalogs::list_block_materials,
            commands::catalogs::list_print_materials,
            commands::catalogs::list_finishing_materials,
            commands::catalogs::list_all_materials,
            commands::catalogs::create_material,
            commands::catalogs::update_material,
            commands::catalogs::delete_material,
            commands::catalogs::list_extra_option_types,
            commands::catalogs::list_all_extra_option_types,
            commands::catalogs::create_extra_option_type,
            commands::catalogs::update_extra_option_type,
            commands::catalogs::delete_extra_option_type,
            commands::catalogs::list_company_accounts,
            // Catalogs v10: dynamic pricing options
            commands::catalogs::list_print_categories,
            commands::catalogs::list_all_print_categories,
            commands::catalogs::create_print_category,
            commands::catalogs::update_print_category,
            commands::catalogs::delete_print_category,
            commands::catalogs::list_assembly_kinds,
            commands::catalogs::list_all_assembly_kinds,
            commands::catalogs::create_assembly_kind,
            commands::catalogs::update_assembly_kind,
            commands::catalogs::delete_assembly_kind,
            commands::catalogs::list_cover_families,
            commands::catalogs::list_all_cover_families,
            commands::catalogs::create_cover_family,
            commands::catalogs::update_cover_family,
            commands::catalogs::delete_cover_family,
            commands::catalogs::list_book_cover_options,
            commands::catalogs::list_all_book_cover_options,
            commands::catalogs::create_book_cover_option,
            commands::catalogs::update_book_cover_option,
            commands::catalogs::delete_book_cover_option,
            commands::catalogs::list_wide_format_materials,
            commands::catalogs::list_all_wide_format_materials,
            commands::catalogs::create_wide_format_material,
            commands::catalogs::update_wide_format_material,
            commands::catalogs::delete_wide_format_material,
            // Pricing
            commands::pricing::list_pricing_programs,
            commands::pricing::create_pricing_program,
            commands::pricing::update_pricing_program,
            commands::pricing::delete_pricing_program,
            commands::pricing::list_pricing_rules,
            commands::pricing::create_pricing_rule,
            commands::pricing::update_pricing_rule,
            commands::pricing::delete_pricing_rule,
            commands::pricing::preview_price,
            // Orders
            commands::orders::create_order,
            commands::orders::get_order,
            commands::orders::update_order,
            commands::orders::confirm_order,
            commands::orders::cancel_order,
            commands::orders::update_production_status,
            commands::orders::update_delivery_status,
            commands::orders::list_orders,
            // Order items
            commands::order_items::list_order_items,
            commands::order_items::add_book_item,
            commands::order_items::add_print_item,
            commands::order_items::add_service_item,
            commands::order_items::add_extra_item,
            commands::order_items::cancel_order_item,
            commands::order_items::update_order_item_price,
            commands::order_items::update_order_item,
            // Order payments & deliveries
            commands::order_payments::register_payment,
            commands::order_payments::register_refund,
            commands::order_payments::register_delivery,
            commands::order_payments::list_order_payments,
            commands::order_payments::list_order_refunds,
            commands::order_payments::list_order_deliveries,
            // Production
            commands::production::advance_production_step,
            commands::production::list_production_queue,
            commands::production::list_production_log,
            // Finance
            commands::finance::list_accounts,
            commands::finance::create_account,
            commands::finance::update_account,
            commands::finance::archive_account,
            commands::finance::register_other_income,
            commands::finance::register_company_expense,
            commands::finance::transfer_between_accounts,
            commands::finance::link_transaction_to_order,
            commands::finance::list_transactions,
            commands::finance::open_liability,
            commands::finance::pay_liability,
            commands::finance::list_liabilities,
            commands::finance::register_partner_contribution,
            commands::finance::register_partner_expense,
            commands::finance::reimburse_partner,
            commands::finance::register_partner_draw,
            commands::finance::register_partner_profit_payout,
            commands::finance::list_partner_settlements,
            commands::finance::close_period,
            commands::finance::list_closing_periods,
            commands::finance::get_finance_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

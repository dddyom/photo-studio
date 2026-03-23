import { invoke } from "@tauri-apps/api/core";

// ── System types ─────────────────────────────────────────────────────

export interface DbInfo {
  path: string;
  version: number;
  size_bytes: number;
}

export interface AppSettings {
  company_name: string;
}

// ── Client types ─────────────────────────────────────────────────────

export interface Client {
  id: number;
  name: string;
  phone: string | null;
  email: string | null;
  default_pricing_program_id: number | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClientInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  default_pricing_program_id?: number | null;
  notes?: string | null;
}

export interface UpdateClientInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  default_pricing_program_id?: number | null;
  notes?: string | null;
}

// ── Catalog types ────────────────────────────────────────────────────

export interface CatalogItem {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface MaterialItem {
  id: number;
  name: string;
  category: string;
  is_active: boolean;
  sort_order: number;
}

export interface ExtraOptionType {
  id: number;
  name: string;
  default_price: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface CodeCatalogItem {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface CoverFamilyItem {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface BookCoverOptionItem {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
  cover_family_codes: string[];
}

export interface PrintCategoryItem {
  id: number;
  code: string;
  name: string;
  unit: string;
  field_type: string; // "format" | "material" | "lamination"
  is_active: boolean;
  sort_order: number;
  has_printing: boolean;
  has_assembly: boolean;
}

export interface CreateCodeCatalogInput {
  code: string;
  name: string;
  sort_order?: number;
}

export interface UpdateCodeCatalogInput {
  code?: string;
  name?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface CreatePrintCategoryInput {
  code: string;
  name: string;
  unit?: string;
  field_type?: string;
  sort_order?: number;
  has_printing?: boolean;
  has_assembly?: boolean;
}

export interface UpdatePrintCategoryInput {
  code?: string;
  name?: string;
  unit?: string;
  field_type?: string;
  is_active?: boolean;
  sort_order?: number;
  has_printing?: boolean;
  has_assembly?: boolean;
}

export interface CreateCatalogInput {
  name: string;
  sort_order?: number;
}

export interface UpdateCatalogInput {
  name?: string;
  is_active?: boolean;
  sort_order?: number;
}

export interface CreateMaterialInput {
  name: string;
  category: string;
  sort_order?: number;
}

export interface CreateExtraOptionInput {
  name: string;
  default_price?: number | null;
  sort_order?: number;
}

export interface UpdateExtraOptionInput {
  name?: string;
  default_price?: number | null;
  is_active?: boolean;
  sort_order?: number;
}

// ── Pricing types ────────────────────────────────────────────────────

export interface PricingProgram {
  id: number;
  name: string;
  is_active: boolean;
  rules_count: number;
  clients_count: number;
}

export interface PricingRule {
  id: number;
  pricing_program_id: number;
  item_kind: string;
  match_params: string;
  price_formula: string;
  is_active: boolean;
}

export interface CreateProgramInput {
  name: string;
  source_program_id?: number | null;
}

export interface UpdateProgramInput {
  name?: string;
  is_active?: boolean;
}

export interface CreateRuleInput {
  pricing_program_id: number;
  item_kind: string;
  match_params: string;
  price_formula: string;
}

export interface UpdateRuleInput {
  match_params?: string;
  price_formula?: string;
  is_active?: boolean;
}

export interface PricePreviewInput {
  pricing_program_id: number;
  item_kind: string;
  spec_json: string;
  qty: number;
}

export interface CalculatedPrice {
  unit_price: number;
  total_price: number;
  breakdown_json: string;
}

export interface CategoryPricesInput {
  pricing_program_id: number;
  item_kind: string;
  category: string;
  field_key: string;
  values: string[];
}

export interface CategoryPriceEntry {
  value: string;
  unit_price: number;
}

export interface BookPricesInput {
  pricing_program_id: number;
  assembly_kind: string;
  cover_family: string;
  format_names: string[];
  cover_option_names: string[];
}

export interface BookPrices {
  block_per_spread: CategoryPriceEntry[];
  cover: CategoryPriceEntry[];
  cover_options: CategoryPriceEntry[];
}

// ── Order types ──────────────────────────────────────────────────────

export type ProductionStatus =
  | "draft"
  | "confirmed"
  | "in_work"
  | "ready"
  | "closed"
  | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "overpaid";
export type DeliveryStatus =
  | "not_delivered"
  | "partially_delivered"
  | "delivered";

export interface Order {
  id: number;
  number: string;
  client_id: number;
  client_name: string | null;
  pricing_program_id: number | null;
  production_status: ProductionStatus;
  payment_status: PaymentStatus;
  delivery_status: DeliveryStatus;
  total_amount: number;
  paid_amount: number;
  debt_amount: number;
  notes: string | null;
  due_date: string | null;
  folder_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateOrderInput {
  client_id: number;
  pricing_program_id?: number | null;
  notes?: string | null;
  due_date?: string | null;
  folder_path?: string | null;
}

export interface UpdateOrderInput {
  notes?: string | null;
  due_date?: string | null;
  folder_path?: string | null;
}

export interface OrderListFilter {
  client_id?: number | null;
  production_status?: string | null;
  payment_status?: string | null;
  delivery_status?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  unpaid_only?: boolean | null;
  delivered_but_unpaid?: boolean | null;
}

// ── Order item types ─────────────────────────────────────────────────

export type ItemKind = "book" | "print" | "service" | "extra";
export type ProductionStep = "pending" | "printed" | "assembled" | "done";

export interface OrderItem {
  id: number;
  order_id: number;
  item_kind: ItemKind;
  description: string | null;
  qty: number;
  unit_price: number;
  total_price: number;
  price_source: "auto" | "manual";
  manual_price_reason: string | null;
  spec_snapshot_json: string;
  price_breakdown_json: string;
  is_cancelled: boolean;
  production_step: ProductionStep;
  note: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductionQueueItem {
  order_item_id: number;
  order_id: number;
  order_number: string;
  client_name: string;
  item_kind: ItemKind;
  description: string | null;
  qty: number;
  production_step: ProductionStep;
  folder_path: string | null;
  created_at: string;
}

export interface ProductionLogEntry {
  id: number;
  from_step: string;
  to_step: string;
  changed_at: string;
}

export interface ExtraInput {
  extra_option_type_id?: number | null;
  custom_name?: string | null;
  qty: number;
  unit_price?: number | null;
}

export interface AddBookItemInput {
  order_id: number;
  book_format_id: number;
  spread_count: number;
  assembly_kind?: string | null;
  cover_family?: string | null;
  cover_options?: string[] | null;
  block_material_id?: number | null;
  cover_type_id?: number | null;
  cover_material_id?: number | null;
  qty: number;
  manual_price?: number | null;
  manual_price_reason?: string | null;
  note?: string | null;
  extras?: ExtraInput[] | null;
}

export interface AddPrintItemInput {
  order_id: number;
  category?: string | null;
  print_format_id?: number | null;
  print_material_id?: number | null;
  finishing_id?: number | null;
  wide_format_material?: string | null;
  lamination_type?: string | null;
  qty: number;
  manual_price?: number | null;
  manual_price_reason?: string | null;
  note?: string | null;
}

export interface AddServiceItemInput {
  order_id: number;
  description: string;
  qty: number;
  unit_price: number;
  note?: string | null;
}

export interface AddExtraItemInput {
  order_id: number;
  extra_option_type_id?: number | null;
  custom_name?: string | null;
  qty: number;
  unit_price?: number | null;
  note?: string | null;
}

export interface UpdateItemPriceInput {
  unit_price: number;
  reason: string;
}

export interface UpdateOrderItemInput {
  qty?: number;
  unit_price?: number;
  description?: string;
  manual_price_reason?: string;
}

// ── Payment types ────────────────────────────────────────────────────

export interface OrderPayment {
  id: number;
  order_id: number;
  amount: number;
  payment_method: string;
  account_id: number;
  finance_transaction_id: number | null;
  notes: string | null;
  paid_at: string;
  created_at: string;
}

export interface RegisterPaymentInput {
  order_id: number;
  amount: number;
  payment_method: string;
  account_id: number;
  notes?: string | null;
}

export interface OrderRefund {
  id: number;
  order_id: number;
  amount: number;
  payment_method: string;
  account_id: number;
  finance_transaction_id: number | null;
  reason: string | null;
  refunded_at: string;
  created_at: string;
}

export interface RegisterRefundInput {
  order_id: number;
  amount: number;
  payment_method: string;
  account_id: number;
  reason?: string | null;
}

export interface OrderDelivery {
  id: number;
  order_id: number;
  delivered_by: string | null;
  notes: string | null;
  delivered_at: string;
  created_at: string;
}

export interface RegisterDeliveryInput {
  order_id: number;
  delivered_by?: string | null;
  notes?: string | null;
}

// ── Finance types ───────────────────────────────────────────────────

export interface CompanyAccount {
  id: number;
  name: string;
  account_type: string;
  balance: number;
  is_active: boolean;
  created_at: string;
}

export interface FinanceTransaction {
  id: number;
  transaction_type: string;
  amount: number;
  direction: string;
  account_id: number | null;
  account_name: string | null;
  counter_account_id: number | null;
  linked_transaction_id: number | null;
  order_id: number | null;
  order_number: string | null;
  liability_id: number | null;
  partner_id: number | null;
  partner_name: string | null;
  finance_category_id: number | null;
  category_name: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}

export interface Liability {
  id: number;
  liability_type: string;
  counterparty_name: string;
  description: string | null;
  original_amount: number;
  paid_amount: number;
  remaining_amount: number;
  status: string;
  opened_at: string;
  due_date: string | null;
  created_at: string;
}

export interface PartnerSettlementEntry {
  id: number;
  partner_id: number;
  partner_name: string;
  entry_type: string;
  amount: number;
  finance_transaction_id: number | null;
  description: string | null;
  period: string | null;
  created_at: string;
}

export interface ClosingPeriod {
  id: number;
  period: string;
  total_income: number;
  total_expense: number;
  profit: number;
  status: string;
  closed_at: string | null;
  created_at: string;
}

export interface AccountBalance {
  id: number;
  name: string;
  account_type: string;
  balance: number;
}

export interface PartnerSummary {
  partner_id: number;
  partner_name: string;
  contributions: number;
  reimbursements: number;
  profit_accrued: number;
  profit_paid: number;
  draws: number;
  adjustments: number;
  balance: number;
}

export interface FinanceSummary {
  account_balances: AccountBalance[];
  total_balance: number;
  supplier_debt_outstanding: number;
  partner_summaries: PartnerSummary[];
}

export interface ListTransactionsFilter {
  transaction_type?: string | null;
  account_id?: number | null;
  date_from?: string | null;
  date_to?: string | null;
  order_id?: number | null;
}

// ── Backup types ────────────────────────────────────────────────────

export interface BackupInfo {
  filename: string;
  size_bytes: number;
  created_at: string;
}

// ── System commands ──────────────────────────────────────────────────

export const system = {
  getDbInfo: () => invoke<DbInfo>("get_db_info"),
  getSettings: () => invoke<AppSettings>("get_settings"),
  updateSetting: (key: string, value: string) =>
    invoke<void>("update_setting", { key, value }),
  createBackup: () => invoke<BackupInfo>("create_backup"),
  listBackups: () => invoke<BackupInfo[]>("list_backups"),
  restoreBackup: (filename: string) =>
    invoke<string>("restore_backup", { filename }),
  deleteBackup: (filename: string) =>
    invoke<void>("delete_backup", { filename }),
  exportOrdersCsv: () => invoke<string>("export_orders_csv"),
  exportTransactionsCsv: () => invoke<string>("export_transactions_csv"),
  exportPartnerSettlementsCsv: () =>
    invoke<string>("export_partner_settlements_csv"),
  openFolder: (path: string) => invoke<void>("open_folder", { path }),
};

// ── Client commands ──────────────────────────────────────────────────

export const clients = {
  list: () => invoke<Client[]>("list_clients"),
  get: (id: number) => invoke<Client>("get_client", { id }),
  create: (input: CreateClientInput) =>
    invoke<Client>("create_client", { input }),
  update: (id: number, input: UpdateClientInput) =>
    invoke<Client>("update_client", { id, input }),
  listAll: () => invoke<Client[]>("list_all_clients"),
  archive: (id: number) => invoke<void>("archive_client", { id }),
  unarchive: (id: number) => invoke<void>("unarchive_client", { id }),
  delete: (id: number) => invoke<void>("delete_client", { id }),
};

// ── Catalog commands ─────────────────────────────────────────────────

export const catalogs = {
  // Active only (for dropdowns)
  bookFormats: () => invoke<CatalogItem[]>("list_book_formats"),
  printFormats: () => invoke<CatalogItem[]>("list_print_formats"),
  coverTypes: () => invoke<CatalogItem[]>("list_cover_types"),
  coverMaterials: () => invoke<CatalogItem[]>("list_cover_materials"),
  laminationTypes: () => invoke<CatalogItem[]>("list_lamination_types"),
  blockMaterials: () => invoke<CatalogItem[]>("list_block_materials"),
  printMaterials: () => invoke<CatalogItem[]>("list_print_materials"),
  finishingMaterials: () => invoke<CatalogItem[]>("list_finishing_materials"),
  extraOptionTypes: () => invoke<ExtraOptionType[]>("list_extra_option_types"),
  companyAccounts: () => invoke<CatalogItem[]>("list_company_accounts"),
  popularPrintFormats: () => invoke<{ name: string; count: number }[]>("popular_print_formats"),
  popularBookFormats: () => invoke<{ name: string; count: number }[]>("popular_book_formats"),
  // All (for admin)
  allBookFormats: () => invoke<CatalogItem[]>("list_all_book_formats"),
  allPrintFormats: () => invoke<CatalogItem[]>("list_all_print_formats"),
  allCoverTypes: () => invoke<CatalogItem[]>("list_all_cover_types"),
  allCoverMaterials: () => invoke<CatalogItem[]>("list_all_cover_materials"),
  allLaminationTypes: () => invoke<CatalogItem[]>("list_all_lamination_types"),
  allMaterials: () => invoke<MaterialItem[]>("list_all_materials"),
  allExtraOptionTypes: () => invoke<ExtraOptionType[]>("list_all_extra_option_types"),
  // CRUD
  createBookFormat: (input: CreateCatalogInput) => invoke<CatalogItem>("create_book_format", { input }),
  updateBookFormat: (id: number, input: UpdateCatalogInput) => invoke<CatalogItem>("update_book_format", { id, input }),
  deleteBookFormat: (id: number) => invoke<void>("delete_book_format", { id }),
  createPrintFormat: (input: CreateCatalogInput) => invoke<CatalogItem>("create_print_format", { input }),
  updatePrintFormat: (id: number, input: UpdateCatalogInput) => invoke<CatalogItem>("update_print_format", { id, input }),
  deletePrintFormat: (id: number) => invoke<void>("delete_print_format", { id }),
  createCoverType: (input: CreateCatalogInput) => invoke<CatalogItem>("create_cover_type", { input }),
  updateCoverType: (id: number, input: UpdateCatalogInput) => invoke<CatalogItem>("update_cover_type", { id, input }),
  deleteCoverType: (id: number) => invoke<void>("delete_cover_type", { id }),
  createCoverMaterial: (input: CreateCatalogInput) => invoke<CatalogItem>("create_cover_material", { input }),
  updateCoverMaterial: (id: number, input: UpdateCatalogInput) => invoke<CatalogItem>("update_cover_material", { id, input }),
  deleteCoverMaterial: (id: number) => invoke<void>("delete_cover_material", { id }),
  createLaminationType: (input: CreateCatalogInput) => invoke<CatalogItem>("create_lamination_type", { input }),
  updateLaminationType: (id: number, input: UpdateCatalogInput) => invoke<CatalogItem>("update_lamination_type", { id, input }),
  deleteLaminationType: (id: number) => invoke<void>("delete_lamination_type", { id }),
  createMaterial: (input: CreateMaterialInput) => invoke<MaterialItem>("create_material", { input }),
  updateMaterial: (id: number, input: UpdateCatalogInput) => invoke<MaterialItem>("update_material", { id, input }),
  deleteMaterial: (id: number) => invoke<void>("delete_material", { id }),
  createExtraOptionType: (input: CreateExtraOptionInput) => invoke<ExtraOptionType>("create_extra_option_type", { input }),
  updateExtraOptionType: (id: number, input: UpdateExtraOptionInput) => invoke<ExtraOptionType>("update_extra_option_type", { id, input }),
  deleteExtraOptionType: (id: number) => invoke<void>("delete_extra_option_type", { id }),
  // v10: Dynamic pricing catalogs
  printCategories: () => invoke<PrintCategoryItem[]>("list_print_categories"),
  allPrintCategories: () => invoke<PrintCategoryItem[]>("list_all_print_categories"),
  createPrintCategory: (input: CreatePrintCategoryInput) => invoke<PrintCategoryItem>("create_print_category", { input }),
  updatePrintCategory: (id: number, input: UpdatePrintCategoryInput) => invoke<PrintCategoryItem>("update_print_category", { id, input }),
  deletePrintCategory: (id: number) => invoke<void>("delete_print_category", { id }),
  assemblyKinds: () => invoke<CodeCatalogItem[]>("list_assembly_kinds"),
  allAssemblyKinds: () => invoke<CodeCatalogItem[]>("list_all_assembly_kinds"),
  createAssemblyKind: (input: CreateCodeCatalogInput) => invoke<CodeCatalogItem>("create_assembly_kind", { input }),
  updateAssemblyKind: (id: number, input: UpdateCodeCatalogInput) => invoke<CodeCatalogItem>("update_assembly_kind", { id, input }),
  deleteAssemblyKind: (id: number) => invoke<void>("delete_assembly_kind", { id }),
  coverFamilies: () => invoke<CoverFamilyItem[]>("list_cover_families"),
  allCoverFamilies: () => invoke<CoverFamilyItem[]>("list_all_cover_families"),
  createCoverFamily: (input: CreateCodeCatalogInput) => invoke<CodeCatalogItem>("create_cover_family", { input }),
  updateCoverFamily: (id: number, input: UpdateCodeCatalogInput) => invoke<CodeCatalogItem>("update_cover_family", { id, input }),
  deleteCoverFamily: (id: number) => invoke<void>("delete_cover_family", { id }),
  bookCoverOptions: () => invoke<BookCoverOptionItem[]>("list_book_cover_options"),
  allBookCoverOptions: () => invoke<BookCoverOptionItem[]>("list_all_book_cover_options"),
  createBookCoverOption: (input: CreateCatalogInput) => invoke<CatalogItem>("create_book_cover_option", { input }),
  updateBookCoverOption: (id: number, input: UpdateCatalogInput) => invoke<CatalogItem>("update_book_cover_option", { id, input }),
  deleteBookCoverOption: (id: number) => invoke<void>("delete_book_cover_option", { id }),
  setCoverOptionFamilies: (cover_option_id: number, cover_family_codes: string[]) =>
    invoke<void>("set_cover_option_families", { input: { cover_option_id, cover_family_codes } }),
  wideFormatMaterials: () => invoke<CatalogItem[]>("list_wide_format_materials"),
  allWideFormatMaterials: () => invoke<CatalogItem[]>("list_all_wide_format_materials"),
  createWideFormatMaterial: (input: CreateCatalogInput) => invoke<CatalogItem>("create_wide_format_material", { input }),
  updateWideFormatMaterial: (id: number, input: UpdateCatalogInput) => invoke<CatalogItem>("update_wide_format_material", { id, input }),
  deleteWideFormatMaterial: (id: number) => invoke<void>("delete_wide_format_material", { id }),
};

// ── Production commands ──────────────────────────────────────────────

export const production = {
  advanceStep: (itemId: number) =>
    invoke<OrderItem>("advance_production_step", { itemId }),
  listQueue: (queue: string) =>
    invoke<ProductionQueueItem[]>("list_production_queue", { queue }),
  listLog: (itemId: number) =>
    invoke<ProductionLogEntry[]>("list_production_log", { itemId }),
};

// ── Pricing commands ─────────────────────────────────────────────────

export const pricing = {
  listPrograms: () => invoke<PricingProgram[]>("list_pricing_programs"),
  createProgram: (input: CreateProgramInput) => invoke<PricingProgram>("create_pricing_program", { input }),
  updateProgram: (id: number, input: UpdateProgramInput) => invoke<PricingProgram>("update_pricing_program", { id, input }),
  deleteProgram: (id: number) => invoke<void>("delete_pricing_program", { id }),
  listRules: (pricingProgramId: number) => invoke<PricingRule[]>("list_pricing_rules", { pricingProgramId }),
  createRule: (input: CreateRuleInput) => invoke<PricingRule>("create_pricing_rule", { input }),
  updateRule: (id: number, input: UpdateRuleInput) => invoke<PricingRule>("update_pricing_rule", { id, input }),
  deleteRule: (id: number) => invoke<void>("delete_pricing_rule", { id }),
  previewPrice: (input: PricePreviewInput) => invoke<CalculatedPrice>("preview_price", { input }),
  listCategoryPrices: (input: CategoryPricesInput) => invoke<CategoryPriceEntry[]>("list_category_prices", { input }),
  listBookPrices: (input: BookPricesInput) => invoke<BookPrices>("list_book_prices", { input }),
};

// ── Order commands ───────────────────────────────────────────────────

export const orders = {
  list: (filter: OrderListFilter = {}) =>
    invoke<Order[]>("list_orders", { filter }),
  get: (id: number) => invoke<Order>("get_order", { id }),
  create: (input: CreateOrderInput) =>
    invoke<Order>("create_order", { input }),
  update: (id: number, input: UpdateOrderInput) =>
    invoke<Order>("update_order", { id, input }),
  confirm: (id: number) => invoke<Order>("confirm_order", { id }),
  cancel: (id: number) => invoke<Order>("cancel_order", { id }),
  updateProductionStatus: (id: number, status: string) =>
    invoke<Order>("update_production_status", { id, status }),
  updateDeliveryStatus: (id: number, status: string) =>
    invoke<Order>("update_delivery_status", { id, status }),
};

// ── Order item commands ──────────────────────────────────────────────

export const orderItems = {
  list: (orderId: number) =>
    invoke<OrderItem[]>("list_order_items", { orderId }),
  addBook: (input: AddBookItemInput) =>
    invoke<OrderItem>("add_book_item", { input }),
  addPrint: (input: AddPrintItemInput) =>
    invoke<OrderItem>("add_print_item", { input }),
  addService: (input: AddServiceItemInput) =>
    invoke<OrderItem>("add_service_item", { input }),
  addExtra: (input: AddExtraItemInput) =>
    invoke<OrderItem>("add_extra_item", { input }),
  cancel: (itemId: number) =>
    invoke<OrderItem>("cancel_order_item", { itemId }),
  updatePrice: (itemId: number, input: UpdateItemPriceInput) =>
    invoke<OrderItem>("update_order_item_price", { itemId, input }),
  update: (itemId: number, input: UpdateOrderItemInput) =>
    invoke<OrderItem>("update_order_item", { itemId, input }),
  updateNote: (itemId: number, note: string | null) =>
    invoke<OrderItem>("update_order_item_note", { itemId, note }),
};

// ── Payment commands ─────────────────────────────────────────────────

export const orderPayments = {
  list: (orderId: number) =>
    invoke<OrderPayment[]>("list_order_payments", { orderId }),
  register: (input: RegisterPaymentInput) =>
    invoke<OrderPayment>("register_payment", { input }),
  listRefunds: (orderId: number) =>
    invoke<OrderRefund[]>("list_order_refunds", { orderId }),
  registerRefund: (input: RegisterRefundInput) =>
    invoke<OrderRefund>("register_refund", { input }),
  listDeliveries: (orderId: number) =>
    invoke<OrderDelivery[]>("list_order_deliveries", { orderId }),
  registerDelivery: (input: RegisterDeliveryInput) =>
    invoke<OrderDelivery>("register_delivery", { input }),
};

// ── Finance commands ────────────────────────────────────────────────

export const finance = {
  listAccounts: () => invoke<CompanyAccount[]>("list_accounts"),
  createAccount: (input: { name: string; account_type: string }) =>
    invoke<CompanyAccount>("create_account", { input }),
  updateAccount: (input: { id: number; name: string; account_type: string }) =>
    invoke<CompanyAccount>("update_account", { input }),
  archiveAccount: (id: number) => invoke<void>("archive_account", { id }),

  registerOtherIncome: (input: {
    amount: number;
    account_id: number;
    finance_category_id?: number | null;
    description?: string | null;
    transaction_date?: string | null;
  }) => invoke<FinanceTransaction>("register_other_income", { input }),

  registerCompanyExpense: (input: {
    amount: number;
    account_id: number;
    finance_category_id?: number | null;
    description?: string | null;
    transaction_date?: string | null;
  }) => invoke<FinanceTransaction>("register_company_expense", { input }),

  transferBetweenAccounts: (input: {
    amount: number;
    from_account_id: number;
    to_account_id: number;
    description?: string | null;
    transaction_date?: string | null;
  }) => invoke<FinanceTransaction>("transfer_between_accounts", { input }),

  linkTransactionToOrder: (input: {
    transaction_id: number;
    order_id: number;
  }) => invoke<void>("link_transaction_to_order", { input }),

  listTransactions: (filter: ListTransactionsFilter = {}) =>
    invoke<FinanceTransaction[]>("list_transactions", { filter }),

  openLiability: (input: {
    liability_type: string;
    counterparty_name: string;
    original_amount: number;
    description?: string | null;
    opened_at?: string | null;
    due_date?: string | null;
  }) => invoke<Liability>("open_liability", { input }),

  payLiability: (input: {
    liability_id: number;
    amount: number;
    account_id: number;
    description?: string | null;
    transaction_date?: string | null;
  }) => invoke<Liability>("pay_liability", { input }),

  listLiabilities: (status?: string | null) =>
    invoke<Liability[]>("list_liabilities", { status }),

  registerPartnerContribution: (input: {
    partner_id: number;
    amount: number;
    account_id: number;
    description?: string | null;
    transaction_date?: string | null;
  }) => invoke<PartnerSettlementEntry>("register_partner_contribution", { input }),

  registerPartnerExpense: (input: {
    partner_id: number;
    amount: number;
    finance_category_id?: number | null;
    description?: string | null;
    transaction_date?: string | null;
  }) => invoke<PartnerSettlementEntry>("register_partner_expense", { input }),

  reimbursePartner: (input: {
    partner_id: number;
    amount: number;
    account_id: number;
    description?: string | null;
    transaction_date?: string | null;
  }) => invoke<PartnerSettlementEntry>("reimburse_partner", { input }),

  registerPartnerDraw: (input: {
    partner_id: number;
    amount: number;
    account_id: number;
    description?: string | null;
    transaction_date?: string | null;
  }) => invoke<PartnerSettlementEntry>("register_partner_draw", { input }),

  registerPartnerProfitPayout: (input: {
    partner_id: number;
    amount: number;
    account_id: number;
    description?: string | null;
    transaction_date?: string | null;
  }) => invoke<PartnerSettlementEntry>("register_partner_profit_payout", { input }),

  listPartnerSettlements: (partnerId?: number | null) =>
    invoke<PartnerSettlementEntry[]>("list_partner_settlements", { partnerId }),

  closePeriod: (input: { period: string; force?: boolean | null }) =>
    invoke<ClosingPeriod>("close_period", { input }),

  listClosingPeriods: () => invoke<ClosingPeriod[]>("list_closing_periods"),

  getSummary: () => invoke<FinanceSummary>("get_finance_summary"),
};

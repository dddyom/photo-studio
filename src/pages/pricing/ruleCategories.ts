import type {
  PricingRule,
  PrintCategoryItem,
  CodeCatalogItem,
  CatalogItem,
} from "@/infrastructure/tauri-bridge";

// ── Rule category types ──────────────────────────────────────────────

export type BookComponent = "book_block" | "book_cover" | "book_cover_option";

// RuleCategory is now a string — either a print category code or a BookComponent
export type RuleCategory = string;

// ── Category metadata ────────────────────────────────────────────────

export interface CategoryMeta {
  key: RuleCategory;
  label: string;
  group: string;
  itemKind: "print" | "book";
  unit: string;
  fields: CategoryField[];
}

export interface CategoryField {
  key: string;
  label: string;
  type: "format_select" | "text_select" | "text";
  options?: { value: string; label: string }[];
  catalogKey?: string; // key in catalogs to load options dynamically
}

// ── Catalog data for building dynamic categories ─────────────────────

export interface PricingCatalogs {
  printCategories: PrintCategoryItem[];
  assemblyKinds: CodeCatalogItem[];
  coverFamilies: CodeCatalogItem[];
  bookCoverOptions: CatalogItem[];
  wideFormatMaterials: CatalogItem[];
  laminationTypes: CatalogItem[];
}

// Build field definition based on print category field_type
function buildPrintCategoryField(
  cat: PrintCategoryItem,
  catalogs: PricingCatalogs
): CategoryField {
  if (cat.field_type === "material") {
    return {
      key: "material",
      label: "Материал",
      type: "text_select",
      options: catalogs.wideFormatMaterials.map((m) => ({
        value: m.name,
        label: m.name,
      })),
    };
  }
  if (cat.field_type === "lamination") {
    return {
      key: "lamination_type",
      label: "Тип ламинации",
      type: "text_select",
      options: catalogs.laminationTypes.map((t) => ({
        value: t.name,
        label: t.name,
      })),
    };
  }
  // Default: format
  return {
    key: "format",
    label: "Формат",
    type: "format_select",
    catalogKey: "printFormats",
  };
}

// Build the full RULE_CATEGORIES array dynamically from catalog data
export function buildRuleCategories(catalogs: PricingCatalogs): CategoryMeta[] {
  const categories: CategoryMeta[] = [];

  // Print categories from DB
  for (const cat of catalogs.printCategories) {
    categories.push({
      key: cat.code,
      label: cat.name,
      group: "Печать",
      itemKind: "print",
      unit: `за ${cat.unit}`,
      fields: [buildPrintCategoryField(cat, catalogs)],
    });
  }

  // Book categories (structural — always the same 3 types)
  categories.push({
    key: "book_block",
    label: "Фотокнига — блок/сборка",
    group: "Фотокниги",
    itemKind: "book",
    unit: "за разворот",
    fields: [
      {
        key: "assembly_kind",
        label: "Тип сборки",
        type: "text_select",
        options: catalogs.assemblyKinds.map((a) => ({
          value: a.code,
          label: a.name,
        })),
      },
      {
        key: "format",
        label: "Формат книги",
        type: "format_select",
        catalogKey: "bookFormats",
      },
    ],
  });

  categories.push({
    key: "book_cover",
    label: "Фотокнига — обложка",
    group: "Фотокниги",
    itemKind: "book",
    unit: "за книгу",
    fields: [
      {
        key: "cover_family",
        label: "Тип обложки",
        type: "text_select",
        options: catalogs.coverFamilies.map((c) => ({
          value: c.code,
          label: c.name,
        })),
      },
      {
        key: "format",
        label: "Формат книги",
        type: "format_select",
        catalogKey: "bookFormats",
      },
    ],
  });

  categories.push({
    key: "book_cover_option",
    label: "Фотокнига — опция обложки",
    group: "Фотокниги",
    itemKind: "book",
    unit: "за книгу",
    fields: [
      {
        key: "option_name",
        label: "Опция",
        type: "text_select",
        options: catalogs.bookCoverOptions.map((o) => ({
          value: o.name,
          label: o.name,
        })),
      },
    ],
  });

  return categories;
}

// Convenience: get meta from a prebuilt list
export function getCategoryMeta(
  key: RuleCategory,
  allCategories: CategoryMeta[]
): CategoryMeta | undefined {
  return allCategories.find((c) => c.key === key);
}

// ── Category detection from existing rule ────────────────────────────

export function detectRuleCategory(
  rule: PricingRule,
  allCategories: CategoryMeta[]
): RuleCategory | null {
  let matchObj: Record<string, string>;
  try {
    matchObj = JSON.parse(rule.match_params);
  } catch {
    return null;
  }

  if (rule.item_kind === "print") {
    const cat = matchObj.category;
    if (cat && allCategories.some((c) => c.key === cat)) {
      return cat;
    }
    return null;
  }

  if (rule.item_kind === "book") {
    const comp = matchObj.component;
    if (comp === "block") return "book_block";
    if (comp === "cover") return "book_cover";
    if (comp === "cover_option") return "book_cover_option";
    return null;
  }

  return null;
}

// ── Extract form values from existing rule match_params ──────────────

export function extractFormValues(
  rule: PricingRule,
  category: RuleCategory,
  allCategories: CategoryMeta[]
): Record<string, string> {
  let matchObj: Record<string, string>;
  try {
    matchObj = JSON.parse(rule.match_params);
  } catch {
    return {};
  }

  const meta = getCategoryMeta(category, allCategories);
  if (!meta) return {};

  const values: Record<string, string> = {};
  for (const field of meta.fields) {
    if (matchObj[field.key] !== undefined) {
      values[field.key] = matchObj[field.key];
    }
  }
  return values;
}

export function extractPrice(rule: PricingRule): number {
  try {
    const formula = JSON.parse(rule.price_formula);
    if (formula.type === "fixed") return formula.price ?? 0;
    if (formula.type === "base_plus_per_unit") return formula.per_unit ?? 0;
    return 0;
  } catch {
    return 0;
  }
}

// ── Build match_params JSON from form values ─────────────────────────

export function buildMatchParams(
  category: RuleCategory,
  fieldValues: Record<string, string>,
  allCategories: CategoryMeta[]
): string {
  const params: Record<string, string> = {};

  const meta = getCategoryMeta(category, allCategories);
  if (!meta) return "{}";

  if (meta.itemKind === "print") {
    params.category = category;
    for (const field of meta.fields) {
      if (fieldValues[field.key]) {
        params[field.key] = fieldValues[field.key];
      }
    }
  } else if (category === "book_block") {
    params.component = "block";
    if (fieldValues.assembly_kind) params.assembly_kind = fieldValues.assembly_kind;
    if (fieldValues.format) params.format = fieldValues.format;
  } else if (category === "book_cover") {
    params.component = "cover";
    if (fieldValues.cover_family) params.cover_family = fieldValues.cover_family;
    if (fieldValues.format) params.format = fieldValues.format;
  } else if (category === "book_cover_option") {
    params.component = "cover_option";
    if (fieldValues.option_name) params.option_name = fieldValues.option_name;
  }

  return JSON.stringify(params);
}

export function buildPriceFormula(price: number): string {
  return JSON.stringify({ type: "fixed", price });
}

// ── Human-readable summary ───────────────────────────────────────────

export function formatRuleSummary(
  rule: PricingRule,
  allCategories: CategoryMeta[]
): string {
  const category = detectRuleCategory(rule, allCategories);
  if (!category) {
    return `${rule.item_kind} / ${rule.match_params}`;
  }

  const meta = getCategoryMeta(category, allCategories);
  if (!meta) return rule.match_params;

  const values = extractFormValues(rule, category, allCategories);
  const price = extractPrice(rule);

  const parts: string[] = [meta.label];

  for (const field of meta.fields) {
    const val = values[field.key];
    if (val) {
      const opt = field.options?.find((o) => o.value === val);
      parts.push(opt ? opt.label : val);
    }
  }

  parts.push(`${formatMoney(price)} ${meta.unit}`);

  return parts.join(" / ");
}

export function formatRulePreview(
  category: RuleCategory,
  fieldValues: Record<string, string>,
  price: number,
  programName: string,
  allCategories: CategoryMeta[]
): string {
  const meta = getCategoryMeta(category, allCategories);
  if (!meta) return "";

  const parts: string[] = [];

  for (const field of meta.fields) {
    const val = fieldValues[field.key];
    if (val) {
      const opt = field.options?.find((o) => o.value === val);
      parts.push(`${field.label.toLowerCase()}: ${opt ? opt.label : val}`);
    }
  }

  const paramsStr = parts.length > 0 ? `, ${parts.join(", ")}` : "";

  return `Для программы «${programName}»: ${meta.label.toLowerCase()}${paramsStr} — ${formatMoney(price)} ${meta.unit}`;
}

function formatMoney(amount: number): string {
  return amount % 1 === 0
    ? amount.toLocaleString("ru-RU")
    : amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 });
}

// ── Group rules by category for display ──────────────────────────────

export interface RuleGroup {
  category: RuleCategory | null;
  label: string;
  groupName: string;
  rules: PricingRule[];
}

export function groupRulesByCategory(
  rules: PricingRule[],
  allCategories: CategoryMeta[]
): RuleGroup[] {
  const groups = new Map<string, RuleGroup>();

  for (const rule of rules) {
    const category = detectRuleCategory(rule, allCategories);
    const key = category ?? `unknown_${rule.item_kind}`;

    if (!groups.has(key)) {
      const meta = category
        ? getCategoryMeta(category, allCategories)
        : null;
      groups.set(key, {
        category,
        label: meta?.label ?? `${rule.item_kind} (прочие)`,
        groupName: meta?.group ?? "Прочие",
        rules: [],
      });
    }

    groups.get(key)!.rules.push(rule);
  }

  // Sort: Печать first, then Фотокниги, then Прочие
  const groupOrder = ["Печать", "Фотокниги", "Прочие"];
  const categoryOrder = allCategories.map((c) => c.key);

  return Array.from(groups.values()).sort((a, b) => {
    const ga = groupOrder.indexOf(a.groupName);
    const gb = groupOrder.indexOf(b.groupName);
    if (ga !== gb) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);

    const ca = a.category ? categoryOrder.indexOf(a.category) : 99;
    const cb = b.category ? categoryOrder.indexOf(b.category) : 99;
    return ca - cb;
  });
}

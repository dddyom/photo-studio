import type { PricingRule } from "@/infrastructure/tauri-bridge";

// ── Rule category types ──────────────────────────────────────────────

export type PrintCategory =
  | "lab_print"
  | "wide_format_print"
  | "wide_format_lamination"
  | "photo_lamination"
  | "photo_magnet"
  | "photo_pvc"
  | "dsp_picture"
  | "canvas_stretched"
  | "calendar_double_sided";

export type BookComponent = "book_block" | "book_cover" | "book_cover_option";

export type RuleCategory = PrintCategory | BookComponent;

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

export const RULE_CATEGORIES: CategoryMeta[] = [
  // ── Print categories ──
  {
    key: "lab_print",
    label: "Лабораторная печать",
    group: "Печать",
    itemKind: "print",
    unit: "за шт.",
    fields: [
      { key: "format", label: "Формат", type: "format_select", catalogKey: "printFormats" },
    ],
  },
  {
    key: "wide_format_print",
    label: "Широкоформатная печать",
    group: "Печать",
    itemKind: "print",
    unit: "за пог. м",
    fields: [
      {
        key: "material",
        label: "Материал",
        type: "text_select",
        options: [
          { value: "Фотобумага матовая 106 см, самоклейка", label: "Фотобумага матовая 106 см, самоклейка" },
          { value: "Печать на холсте, ширина 60 см", label: "Печать на холсте, ширина 60 см" },
          { value: "Печать на холсте, ширина 90 см", label: "Печать на холсте, ширина 90 см" },
        ],
      },
    ],
  },
  {
    key: "wide_format_lamination",
    label: "Ламинация широкоформатки",
    group: "Печать",
    itemKind: "print",
    unit: "за кв. м",
    fields: [
      {
        key: "lamination_type",
        label: "Тип ламинации",
        type: "text_select",
        options: [
          { value: "Матовая", label: "Матовая" },
          { value: "Глянцевая", label: "Глянцевая" },
          { value: "Лён", label: "Лён" },
          { value: "Алмазная", label: "Алмазная" },
        ],
      },
    ],
  },
  {
    key: "photo_lamination",
    label: "Ламинация фото",
    group: "Печать",
    itemKind: "print",
    unit: "за шт.",
    fields: [
      { key: "format", label: "Формат", type: "format_select", catalogKey: "printFormats" },
    ],
  },
  {
    key: "photo_magnet",
    label: "Фото на магните",
    group: "Печать",
    itemKind: "print",
    unit: "за шт.",
    fields: [
      { key: "format", label: "Формат", type: "format_select", catalogKey: "printFormats" },
    ],
  },
  {
    key: "photo_pvc",
    label: "Фото на ПВХ",
    group: "Печать",
    itemKind: "print",
    unit: "за шт.",
    fields: [
      { key: "format", label: "Формат", type: "format_select", catalogKey: "printFormats" },
    ],
  },
  {
    key: "dsp_picture",
    label: "Картина на ДСП",
    group: "Печать",
    itemKind: "print",
    unit: "за шт.",
    fields: [
      { key: "format", label: "Формат", type: "format_select", catalogKey: "printFormats" },
    ],
  },
  {
    key: "canvas_stretched",
    label: "Холст на подрамнике",
    group: "Печать",
    itemKind: "print",
    unit: "за шт.",
    fields: [
      { key: "format", label: "Формат", type: "format_select", catalogKey: "printFormats" },
    ],
  },
  {
    key: "calendar_double_sided",
    label: "Двусторонний календарь",
    group: "Печать",
    itemKind: "print",
    unit: "за шт.",
    fields: [
      { key: "format", label: "Формат", type: "format_select", catalogKey: "printFormats" },
    ],
  },

  // ── Book categories ──
  {
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
        options: [
          { value: "plastic", label: "Пластик (plastic)" },
          { value: "pvc_board", label: "ПВХ-основа (pvc_board)" },
        ],
      },
      { key: "format", label: "Формат книги", type: "format_select", catalogKey: "bookFormats" },
    ],
  },
  {
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
        options: [
          { value: "laminated_hard", label: "Ламинированная жёсткая" },
          { value: "eco_leather", label: "Экокожа" },
        ],
      },
      { key: "format", label: "Формат книги", type: "format_select", catalogKey: "bookFormats" },
    ],
  },
  {
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
        options: [
          { value: "Гравировка", label: "Гравировка" },
          { value: "Фото-вставка", label: "Фото-вставка" },
        ],
      },
    ],
  },
];

export function getCategoryMeta(key: RuleCategory): CategoryMeta | undefined {
  return RULE_CATEGORIES.find((c) => c.key === key);
}

// ── Category detection from existing rule ────────────────────────────

export function detectRuleCategory(rule: PricingRule): RuleCategory | null {
  let matchObj: Record<string, string>;
  try {
    matchObj = JSON.parse(rule.match_params);
  } catch {
    return null;
  }

  if (rule.item_kind === "print") {
    const cat = matchObj.category;
    if (cat && RULE_CATEGORIES.some((c) => c.key === cat)) {
      return cat as PrintCategory;
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
  category: RuleCategory
): Record<string, string> {
  let matchObj: Record<string, string>;
  try {
    matchObj = JSON.parse(rule.match_params);
  } catch {
    return {};
  }

  const meta = getCategoryMeta(category);
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
  fieldValues: Record<string, string>
): string {
  const params: Record<string, string> = {};

  const meta = getCategoryMeta(category);
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

export function formatRuleSummary(rule: PricingRule): string {
  const category = detectRuleCategory(rule);
  if (!category) {
    // Fallback for unknown rules
    return `${rule.item_kind} / ${rule.match_params}`;
  }

  const meta = getCategoryMeta(category);
  if (!meta) return rule.match_params;

  const values = extractFormValues(rule, category);
  const price = extractPrice(rule);

  const parts: string[] = [meta.label];

  for (const field of meta.fields) {
    const val = values[field.key];
    if (val) {
      // For selects, try to find the human label
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
  programName: string
): string {
  const meta = getCategoryMeta(category);
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

export function groupRulesByCategory(rules: PricingRule[]): RuleGroup[] {
  const groups = new Map<string, RuleGroup>();

  for (const rule of rules) {
    const category = detectRuleCategory(rule);
    const key = category ?? `unknown_${rule.item_kind}`;

    if (!groups.has(key)) {
      const meta = category ? getCategoryMeta(category) : null;
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
  const categoryOrder = RULE_CATEGORIES.map((c) => c.key);

  return Array.from(groups.values()).sort((a, b) => {
    const ga = groupOrder.indexOf(a.groupName);
    const gb = groupOrder.indexOf(b.groupName);
    if (ga !== gb) return (ga === -1 ? 99 : ga) - (gb === -1 ? 99 : gb);

    const ca = a.category ? categoryOrder.indexOf(a.category) : 99;
    const cb = b.category ? categoryOrder.indexOf(b.category) : 99;
    return ca - cb;
  });
}

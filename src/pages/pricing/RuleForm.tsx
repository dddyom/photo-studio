import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import {
  pricing,
  catalogs,
  type PricingRule,
  type CatalogItem,
} from "@/infrastructure/tauri-bridge";
import {
  type RuleCategory,
  RULE_CATEGORIES,
  getCategoryMeta,
  buildMatchParams,
  buildPriceFormula,
  extractFormValues,
  extractPrice,
  formatRulePreview,
} from "./ruleCategories";

// ── Category selection step ──────────────────────────────────────────

export function CategorySelector({
  onSelect,
  onCancel,
}: {
  onSelect: (category: RuleCategory) => void;
  onCancel: () => void;
}) {
  const groups = new Map<string, typeof RULE_CATEGORIES>();
  for (const cat of RULE_CATEGORIES) {
    if (!groups.has(cat.group)) groups.set(cat.group, []);
    groups.get(cat.group)!.push(cat);
  }

  return (
    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Выберите тип правила</h3>
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
      </div>
      <div className="space-y-4">
        {Array.from(groups.entries()).map(([group, cats]) => (
          <div key={group}>
            <div className="text-xs font-semibold text-gray-400 uppercase mb-2">
              {group}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {cats.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => onSelect(cat.key)}
                  className="text-left px-3 py-2 bg-white border border-gray-200 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors"
                >
                  <div className="text-sm font-medium">{cat.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{cat.unit}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Typed rule form ──────────────────────────────────────────────────

interface RuleFormProps {
  programId: number;
  programName: string;
  category: RuleCategory;
  editingRule?: PricingRule;
  onSaved: () => void;
  onCancel: () => void;
}

export function RuleForm({
  programId,
  programName,
  category,
  editingRule,
  onSaved,
  onCancel,
}: RuleFormProps) {
  const meta = getCategoryMeta(category);

  // Field values
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(() => {
    if (editingRule) return extractFormValues(editingRule, category);
    return {};
  });
  const [price, setPrice] = useState<string>(() => {
    if (editingRule) return String(extractPrice(editingRule));
    return "";
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Catalog data for format selects
  const [formatOptions, setFormatOptions] = useState<CatalogItem[]>([]);

  useEffect(() => {
    if (!meta) return;
    const formatFields = meta.fields.filter(
      (f) => f.type === "format_select" && f.catalogKey
    );
    if (formatFields.length === 0) return;

    const catalogKey = formatFields[0].catalogKey!;
    const loader =
      catalogKey === "bookFormats"
        ? catalogs.bookFormats
        : catalogKey === "printFormats"
          ? catalogs.printFormats
          : null;

    if (loader) {
      loader().then(setFormatOptions).catch(() => {});
    }
  }, [meta]);

  if (!meta) return null;

  const setField = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  const priceNum = parseFloat(price) || 0;

  // Validation
  const errors: string[] = [];
  for (const field of meta.fields) {
    if (!fieldValues[field.key]) {
      errors.push(`${field.label} — обязательное поле`);
    }
  }
  if (!price || priceNum <= 0) {
    errors.push("Цена должна быть больше 0");
  }

  const isValid = errors.length === 0;

  // Preview
  const preview =
    isValid && priceNum > 0
      ? formatRulePreview(category, fieldValues, priceNum, programName)
      : null;

  // Generated JSON (for advanced view)
  const generatedMatchParams = buildMatchParams(category, fieldValues);
  const generatedFormula = buildPriceFormula(priceNum);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    try {
      if (editingRule) {
        await pricing.updateRule(editingRule.id, {
          match_params: generatedMatchParams,
          price_formula: generatedFormula,
        });
        toast.success("Правило обновлено");
      } else {
        await pricing.createRule({
          pricing_program_id: programId,
          item_kind: meta.itemKind,
          match_params: generatedMatchParams,
          price_formula: generatedFormula,
        });
        toast.success("Правило создано");
      }
      onSaved();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="px-5 py-4 border-b border-gray-100 bg-gray-50 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {editingRule ? "Редактирование" : "Новое правило"}: {meta.label}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Отмена
        </button>
      </div>

      {/* Dynamic fields */}
      <div className="grid grid-cols-2 gap-3">
        {meta.fields.map((field) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {field.label}
            </label>
            {field.type === "format_select" ? (
              <select
                value={fieldValues[field.key] ?? ""}
                onChange={(e) => setField(field.key, e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">— Выберите —</option>
                {formatOptions.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            ) : field.type === "text_select" ? (
              <select
                value={fieldValues[field.key] ?? ""}
                onChange={(e) => setField(field.key, e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="">— Выберите —</option>
                {field.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={fieldValues[field.key] ?? ""}
                onChange={(e) => setField(field.key, e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
              />
            )}
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Цена ({meta.unit})
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
            placeholder="0"
          />
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          <span className="font-medium">Итоговое описание:</span> {preview}
        </div>
      )}

      {/* Advanced JSON (hidden by default) */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {showAdvanced ? "Скрыть JSON" : "Показать JSON (отладка)"}
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-1">
            <div className="text-xs text-gray-500">
              <span className="font-medium">match_params:</span>{" "}
              <code className="bg-gray-200 px-1 rounded">{generatedMatchParams}</code>
            </div>
            <div className="text-xs text-gray-500">
              <span className="font-medium">price_formula:</span>{" "}
              <code className="bg-gray-200 px-1 rounded">{generatedFormula}</code>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!isValid}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {editingRule ? "Сохранить" : "Добавить правило"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-500 text-sm hover:text-gray-700"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}

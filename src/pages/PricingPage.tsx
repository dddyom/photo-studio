import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  pricing,
  catalogs,
  type PricingProgram,
  type PricingRule,
  type PricePreviewInput,
  type CalculatedPrice,
} from "@/infrastructure/tauri-bridge";
import {
  type RuleCategory,
  type CategoryMeta,
  type PricingCatalogs,
  buildRuleCategories,
  detectRuleCategory,
  getCategoryMeta,
  extractFormValues,
  extractPrice,
  groupRulesByCategory,
} from "./pricing/ruleCategories";
import { CategorySelector, RuleForm } from "./pricing/RuleForm";

// ── Hook: load all pricing catalogs ─────────────────────────────────

function usePricingCatalogs(): {
  allCategories: CategoryMeta[];
  loading: boolean;
} {
  const { data: printCategories } = useTauriCommand(catalogs.printCategories);
  const { data: assemblyKinds } = useTauriCommand(catalogs.assemblyKinds);
  const { data: coverFamilies } = useTauriCommand(catalogs.coverFamilies);
  const { data: bookCoverOptions } = useTauriCommand(catalogs.bookCoverOptions);
  const { data: wideFormatMaterials } = useTauriCommand(
    catalogs.wideFormatMaterials
  );
  const { data: laminationTypes } = useTauriCommand(catalogs.laminationTypes);

  const loading =
    !printCategories ||
    !assemblyKinds ||
    !coverFamilies ||
    !bookCoverOptions ||
    !wideFormatMaterials ||
    !laminationTypes;

  const allCategories = useMemo(() => {
    if (loading) return [];
    const pricingCatalogs: PricingCatalogs = {
      printCategories: printCategories!,
      assemblyKinds: assemblyKinds!,
      coverFamilies: coverFamilies!,
      bookCoverOptions: bookCoverOptions!,
      wideFormatMaterials: wideFormatMaterials!,
      laminationTypes: laminationTypes!,
    };
    return buildRuleCategories(pricingCatalogs);
  }, [
    printCategories,
    assemblyKinds,
    coverFamilies,
    bookCoverOptions,
    wideFormatMaterials,
    laminationTypes,
    loading,
  ]);

  return { allCategories, loading };
}

// ── Main page ────────────────────────────────────────────────────────

export function PricingPage() {
  const navigate = useNavigate();
  const { data: programs, refetch: refetchPrograms } = useTauriCommand(
    pricing.listPrograms
  );
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(
    null
  );
  const [showCreateProgram, setShowCreateProgram] = useState(false);

  const { allCategories, loading: catalogsLoading } = usePricingCatalogs();

  const selectedProgram = programs?.find((p) => p.id === selectedProgramId);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Прайсы</h1>
          <p className="text-gray-500 text-sm mt-1">
            Программы ценообразования и правила расчёта
            <span className="mx-1">&middot;</span>
            <button
              onClick={() => navigate("/pricing/help")}
              className="text-blue-600 hover:text-blue-800"
            >
              Как это работает?
            </button>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[300px_1fr] gap-5">
        {/* Programs list */}
        <div className="bg-white border border-gray-200 rounded-md">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold">Программы</h2>
            <button
              className="text-blue-600 text-sm hover:text-blue-700"
              onClick={() => setShowCreateProgram(!showCreateProgram)}
            >
              {showCreateProgram ? "Отмена" : "+ Добавить"}
            </button>
          </div>

          {showCreateProgram && (
            <CreateProgramForm
              programs={programs ?? []}
              onCreated={() => {
                setShowCreateProgram(false);
                refetchPrograms();
              }}
            />
          )}

          <div className="divide-y divide-gray-100">
            {!programs || programs.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Нет программ
              </div>
            ) : (
              programs.map((p) => (
                <ProgramRow
                  key={p.id}
                  program={p}
                  selected={p.id === selectedProgramId}
                  onClick={() => setSelectedProgramId(p.id)}
                  onToggle={async () => {
                    try {
                      await pricing.updateProgram(p.id, {
                        is_active: !p.is_active,
                      });
                      refetchPrograms();
                    } catch (err) {
                      toast.error(String(err));
                    }
                  }}
                  onDelete={async () => {
                    if (!confirm(`Удалить программу «${p.name}» и все её правила?`)) return;
                    try {
                      await pricing.deleteProgram(p.id);
                      toast.success("Программа удалена");
                      if (selectedProgramId === p.id) setSelectedProgramId(null);
                      refetchPrograms();
                    } catch (err) {
                      toast.error(String(err));
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>

        {/* Rules panel */}
        <div>
          {selectedProgram ? (
            catalogsLoading ? (
              <div className="bg-white border border-gray-200 rounded-md p-10 text-center text-gray-400">
                Загрузка справочников...
              </div>
            ) : (
              <RulesPanel
                program={selectedProgram}
                allCategories={allCategories}
                onProgramUpdated={refetchPrograms}
              />
            )
          ) : (
            <div className="bg-white border border-gray-200 rounded-md p-10 text-center text-gray-400">
              Выберите программу слева
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create program form ──────────────────────────────────────────────

function CreateProgramForm({ programs, onCreated }: { programs: PricingProgram[]; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState<number | "">("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await pricing.createProgram({
        name: name.trim(),
        source_program_id: sourceId || null,
      });
      toast.success("Программа создана");
      setName("");
      setSourceId("");
      onCreated();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <form onSubmit={onSubmit} className="px-4 py-3 border-b border-gray-100 space-y-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название программы"
        className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
        autoFocus
      />
      {programs.length > 0 && (
        <select
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value ? Number(e.target.value) : "")}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Без шаблона (пустая)</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              Копия «{p.name}» ({p.rules_count} правил)
            </option>
          ))}
        </select>
      )}
      <button
        type="submit"
        className="w-full px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
      >
        Создать
      </button>
    </form>
  );
}

// ── Program row ──────────────────────────────────────────────────────

function ProgramRow({
  program: p,
  selected,
  onClick,
  onToggle,
  onDelete,
}: {
  program: PricingProgram;
  selected: boolean;
  onClick: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`px-4 py-3 cursor-pointer transition-colors group ${
        selected ? "bg-blue-50" : "hover:bg-gray-50"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <div
            className={`text-sm font-medium ${!p.is_active ? "text-gray-400 line-through" : ""}`}
          >
            {p.name}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {p.rules_count} правил &middot; {p.clients_count} клиентов
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={`text-xs px-2 py-0.5 rounded ${
              p.is_active
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {p.is_active ? "Активна" : "Неактивна"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-xs text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity px-1"
          >
            Удл.
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rules panel ──────────────────────────────────────────────────────

function RulesPanel({
  program,
  allCategories,
  onProgramUpdated,
}: {
  program: PricingProgram;
  allCategories: CategoryMeta[];
  onProgramUpdated: () => void;
}) {
  const fetchRules = useCallback(
    () => pricing.listRules(program.id),
    [program.id]
  );
  const { data: rules, refetch: refetchRules } = useTauriCommand(fetchRules, [
    program.id,
  ]);
  const [addingCategory, setAddingCategory] = useState<
    RuleCategory | "selecting" | null
  >(null);
  const [editingRule, setEditingRule] = useState<{
    rule: PricingRule;
    category: RuleCategory;
  } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(program.name);
  const [showPreview, setShowPreview] = useState(false);

  const handleRename = async () => {
    if (!nameValue.trim() || nameValue === program.name) {
      setEditingName(false);
      return;
    }
    try {
      await pricing.updateProgram(program.id, { name: nameValue.trim() });
      onProgramUpdated();
      setEditingName(false);
    } catch (err) {
      toast.error(String(err));
    }
  };

  const ruleGroups = groupRulesByCategory(rules ?? [], allCategories);

  // Group rule groups by top-level groupName (Печать, Фотокниги, etc.)
  const topLevelGroups = useMemo(() => {
    const map = new Map<string, typeof ruleGroups>();
    for (const g of ruleGroups) {
      if (!map.has(g.groupName)) map.set(g.groupName, []);
      map.get(g.groupName)!.push(g);
    }
    return Array.from(map.entries());
  }, [ruleGroups]);

  const handleRuleSaved = () => {
    setAddingCategory(null);
    setEditingRule(null);
    refetchRules();
    onProgramUpdated();
  };

  const startEdit = (rule: PricingRule) => {
    const cat = detectRuleCategory(rule, allCategories);
    if (cat) {
      setAddingCategory(null);
      setEditingRule({ rule, category: cat });
    } else {
      toast.error("Неизвестный тип правила");
    }
  };

  const handleToggle = async (rule: PricingRule) => {
    try {
      await pricing.updateRule(rule.id, { is_active: !rule.is_active });
      refetchRules();
      onProgramUpdated();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleDelete = async (rule: PricingRule) => {
    if (!confirm("Удалить это правило?")) return;
    try {
      await pricing.deleteRule(rule.id);
      toast.success("Правило удалено");
      refetchRules();
      onProgramUpdated();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-white border border-gray-200 rounded-md">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            {editingName ? (
              <input
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                autoFocus
                className="px-2 py-1 border border-blue-400 rounded text-base font-semibold focus:outline-none focus:border-blue-500"
              />
            ) : (
              <>
                <h2 className="text-base font-semibold">{program.name}</h2>
                <button
                  onClick={() => {
                    setNameValue(program.name);
                    setEditingName(true);
                  }}
                  className="text-gray-400 hover:text-blue-600"
                  title="Переименовать"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              className="text-sm text-gray-500 hover:text-blue-600"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? "Скрыть" : "Предпросмотр цены"}
            </button>
            <button
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              onClick={() => {
                setEditingRule(null);
                setAddingCategory(addingCategory ? null : "selecting");
              }}
            >
              {addingCategory ? "Отмена" : "+ Правило"}
            </button>
          </div>
        </div>

        {/* Preview panel */}
        {showPreview && <PricePreviewPanel programId={program.id} />}

        {/* Category selector (step 1 of adding) */}
        {addingCategory === "selecting" && (
          <CategorySelector
            allCategories={allCategories}
            onSelect={(cat) => setAddingCategory(cat)}
            onCancel={() => setAddingCategory(null)}
          />
        )}

        {/* Rule form (step 2 of adding, or editing) */}
        {addingCategory && addingCategory !== "selecting" && (
          <RuleForm
            programId={program.id}
            programName={program.name}
            category={addingCategory}
            allCategories={allCategories}
            onSaved={handleRuleSaved}
            onCancel={() => setAddingCategory(null)}
          />
        )}

      </div>

      {/* Rules grouped by top-level section, then category tables */}
      {!rules || rules.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md text-center py-10 text-gray-400 text-sm">
          Нет правил в этой программе
        </div>
      ) : (
        topLevelGroups.map(([groupName, categories]) => (
          <div key={groupName}>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 px-1">
              {groupName}
            </h3>
            <div className="space-y-3">
              {categories.map((group, gi) => {
                const meta = group.category
                  ? getCategoryMeta(group.category, allCategories)
                  : null;
                const fields = meta?.fields ?? [];

                return (
                  <div
                    key={group.category ?? `unk-${gi}`}
                    className="bg-white border border-gray-200 rounded-md overflow-hidden"
                  >
                    {/* Category header */}
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-700">
                          {group.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {group.rules.length}
                        </span>
                      </div>
                      {meta && (
                        <span className="text-xs text-gray-400">{meta.unit}</span>
                      )}
                    </div>

                    {/* Table */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                          {fields.map((f) => (
                            <th
                              key={f.key}
                              className="text-left font-medium px-4 py-1.5"
                            >
                              {f.label}
                            </th>
                          ))}
                          <th className="text-right font-medium px-4 py-1.5">
                            Цена
                          </th>
                          <th className="w-24 px-4 py-1.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {group.rules.map((rule) => {
                          const isEditing = editingRule?.rule.id === rule.id;
                          return (
                            <React.Fragment key={rule.id}>
                              <RuleTableRow
                                rule={rule}
                                fields={fields}
                                category={group.category}
                                allCategories={allCategories}
                                onEdit={() => startEdit(rule)}
                                onToggle={() => handleToggle(rule)}
                                onDelete={() => handleDelete(rule)}
                                isEditing={isEditing}
                              />
                              {isEditing && (
                                <tr>
                                  <td colSpan={fields.length + 2} className="p-0">
                                    <RuleForm
                                      key={rule.id}
                                      programId={program.id}
                                      programName={program.name}
                                      category={editingRule.category}
                                      allCategories={allCategories}
                                      editingRule={rule}
                                      onSaved={handleRuleSaved}
                                      onCancel={() => setEditingRule(null)}
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Rule table row ───────────────────────────────────────────────────

function RuleTableRow({
  rule,
  fields,
  category,
  allCategories,
  onEdit,
  onToggle,
  onDelete,
  isEditing,
}: {
  rule: PricingRule;
  fields: { key: string; label: string; options?: { value: string; label: string }[] }[];
  category: RuleCategory | null;
  allCategories: CategoryMeta[];
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  isEditing?: boolean;
}) {
  const values = category
    ? extractFormValues(rule, category, allCategories)
    : {};
  const price = extractPrice(rule);

  return (
    <tr
      className={`group hover:bg-gray-50 ${!rule.is_active ? "opacity-40" : ""} ${isEditing ? "bg-blue-50" : ""}`}
    >
      {fields.map((f) => {
        const val = values[f.key];
        const opt = f.options?.find((o) => o.value === val);
        return (
          <td key={f.key} className="px-4 py-2 text-gray-700">
            {opt ? opt.label : val || "—"}
          </td>
        );
      })}
      <td className="px-4 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
        {formatMoney(price)} ₸
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onToggle}
            className={`text-xs px-1.5 py-0.5 rounded ${
              rule.is_active
                ? "text-green-600 hover:bg-green-50"
                : "text-gray-400 hover:bg-gray-100"
            }`}
            title={rule.is_active ? "Выключить" : "Включить"}
          >
            {rule.is_active ? "Вкл" : "Выкл"}
          </button>
          <button
            onClick={onEdit}
            className="text-xs text-blue-600 hover:text-blue-700 px-1"
          >
            Изм.
          </button>
          <button
            onClick={onDelete}
            className="text-xs text-red-500 hover:text-red-700 px-1"
          >
            Удл.
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Price preview ────────────────────────────────────────────────────

function PricePreviewPanel({ programId }: { programId: number }) {
  const [itemKind, setItemKind] = useState("book");
  const [specJson, setSpecJson] = useState(
    '{"format":"20x20","spread_count":10}'
  );
  const [qty, setQty] = useState("1");
  const [result, setResult] = useState<CalculatedPrice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ITEM_KIND_OPTIONS = [
    { value: "book", label: "Фотокнига" },
    { value: "print", label: "Печать" },
    { value: "service", label: "Услуга" },
    { value: "extra", label: "Доп. опция" },
  ];

  const handlePreview = async () => {
    setError(null);
    setResult(null);
    try {
      const input: PricePreviewInput = {
        pricing_program_id: programId,
        item_kind: itemKind,
        spec_json: specJson,
        qty: parseInt(qty) || 1,
      };
      const r = await pricing.previewPrice(input);
      setResult(r);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="px-5 py-4 border-b border-gray-100 bg-blue-50 space-y-3">
      <h3 className="text-sm font-semibold text-blue-800">
        Предпросмотр цены
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Тип
          </label>
          <select
            value={itemKind}
            onChange={(e) => setItemKind(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
          >
            {ITEM_KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Кол-во
          </label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
            min={1}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handlePreview}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 w-full"
          >
            Рассчитать
          </button>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Спецификация (JSON)
        </label>
        <input
          value={specJson}
          onChange={(e) => setSpecJson(e.target.value)}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm font-mono"
        />
      </div>
      {result && (
        <div className="p-3 bg-white rounded border border-blue-200">
          <div className="text-sm">
            <span className="text-gray-500">За единицу:</span>{" "}
            <span className="font-semibold">
              {result.unit_price.toFixed(2)} ₸
            </span>
            <span className="text-gray-400 mx-2">&middot;</span>
            <span className="text-gray-500">Итого:</span>{" "}
            <span className="font-semibold">
              {result.total_price.toFixed(2)} ₸
            </span>
          </div>
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 rounded border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────

function formatMoney(amount: number): string {
  return amount % 1 === 0
    ? amount.toLocaleString("ru-RU")
    : amount.toLocaleString("ru-RU", { minimumFractionDigits: 2 });
}

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  pricing,
  type PricingProgram,
  type PricingRule,
  type CreateProgramInput,
  type PricePreviewInput,
  type CalculatedPrice,
} from "@/infrastructure/tauri-bridge";
import {
  type RuleCategory,
  detectRuleCategory,
  getCategoryMeta,
  extractFormValues,
  extractPrice,
  groupRulesByCategory,
} from "./pricing/ruleCategories";
import { CategorySelector, RuleForm } from "./pricing/RuleForm";

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
                />
              ))
            )}
          </div>
        </div>

        {/* Rules panel */}
        <div>
          {selectedProgram ? (
            <RulesPanel
              program={selectedProgram}
              onProgramUpdated={refetchPrograms}
            />
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

function CreateProgramForm({ onCreated }: { onCreated: () => void }) {
  const { register, handleSubmit, reset } = useForm<CreateProgramInput>();

  const onSubmit = async (input: CreateProgramInput) => {
    try {
      await pricing.createProgram(input);
      toast.success("Программа создана");
      reset();
      onCreated();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="px-4 py-3 border-b border-gray-100 flex gap-2"
    >
      <input
        {...register("name", { required: true })}
        placeholder="Название программы"
        className="flex-1 px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
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
}: {
  program: PricingProgram;
  selected: boolean;
  onClick: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={`px-4 py-3 cursor-pointer transition-colors ${
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
      </div>
    </div>
  );
}

// ── Rules panel ──────────────────────────────────────────────────────

function RulesPanel({
  program,
  onProgramUpdated,
}: {
  program: PricingProgram;
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

  const ruleGroups = groupRulesByCategory(rules ?? []);

  const handleRuleSaved = () => {
    setAddingCategory(null);
    setEditingRule(null);
    refetchRules();
    onProgramUpdated();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          {editingName ? (
            <input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleRename}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
              className="px-2 py-1 border border-gray-200 rounded text-sm font-semibold focus:outline-none focus:border-blue-500"
            />
          ) : (
            <h2
              className="text-base font-semibold cursor-pointer hover:text-blue-600"
              onClick={() => {
                setNameValue(program.name);
                setEditingName(true);
              }}
            >
              {program.name}
            </h2>
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
              setAddingCategory(
                addingCategory ? null : "selecting"
              );
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
          onSaved={handleRuleSaved}
          onCancel={() => setAddingCategory(null)}
        />
      )}

      {editingRule && (
        <RuleForm
          programId={program.id}
          programName={program.name}
          category={editingRule.category}
          editingRule={editingRule.rule}
          onSaved={handleRuleSaved}
          onCancel={() => setEditingRule(null)}
        />
      )}

      {/* Rules list grouped by category */}
      <div>
        {!rules || rules.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Нет правил в этой программе
          </div>
        ) : (
          <>
            {ruleGroups.map((group, gi) => (
              <div key={group.category ?? `unk-${gi}`}>
                {/* Group header */}
                <div className="px-5 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 uppercase">
                      {group.label}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">
                      {group.rules.length} правил
                    </span>
                  </div>
                </div>
                {/* Rules in group */}
                {group.rules.map((rule) => (
                  <RuleRow
                    key={rule.id}
                    rule={rule}
                    onEdit={() => {
                      const cat = detectRuleCategory(rule);
                      if (cat) {
                        setAddingCategory(null);
                        setEditingRule({ rule, category: cat });
                      } else {
                        toast.error(
                          "Неизвестный тип правила. Используйте JSON-редактирование."
                        );
                      }
                    }}
                    onUpdated={() => {
                      refetchRules();
                      onProgramUpdated();
                    }}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ── Rule row ─────────────────────────────────────────────────────────

function RuleRow({
  rule,
  onEdit,
  onUpdated,
}: {
  rule: PricingRule;
  onEdit: () => void;
  onUpdated: () => void;
}) {
  const category = detectRuleCategory(rule);
  const meta = category ? getCategoryMeta(category) : null;

  // Extract key values for compact display
  const values = category ? extractFormValues(rule, category) : {};
  const price = extractPrice(rule);

  const handleDelete = async () => {
    if (!confirm("Удалить это правило?")) return;
    try {
      await pricing.deleteRule(rule.id);
      toast.success("Правило удалено");
      onUpdated();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleToggle = async () => {
    try {
      await pricing.updateRule(rule.id, { is_active: !rule.is_active });
      onUpdated();
    } catch (err) {
      toast.error(String(err));
    }
  };

  // Format display value
  const mainParam = meta
    ? meta.fields
        .map((f) => {
          const val = values[f.key];
          if (!val) return null;
          const opt = f.options?.find((o) => o.value === val);
          return opt ? opt.label : val;
        })
        .filter(Boolean)
        .join(", ")
    : null;

  const priceDisplay = meta
    ? `${formatMoney(price)} ${meta.unit}`
    : `${formatMoney(price)}`;

  return (
    <div
      className={`px-5 py-2.5 flex items-center justify-between border-b border-gray-100 ${!rule.is_active ? "opacity-40" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm flex items-center gap-2">
          {mainParam && (
            <span className="text-gray-700">{mainParam}</span>
          )}
          {mainParam && <span className="text-gray-300">&mdash;</span>}
          <span className="font-semibold text-gray-900">{priceDisplay}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 ml-4 shrink-0">
        <button
          onClick={handleToggle}
          className={`text-xs px-2 py-0.5 rounded ${
            rule.is_active
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-500"
          }`}
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
          onClick={handleDelete}
          className="text-xs text-red-500 hover:text-red-700 px-1"
        >
          Удл.
        </button>
      </div>
    </div>
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

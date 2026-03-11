import { useState } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  catalogs,
  orderItems,
  type ItemKind,
} from "@/infrastructure/tauri-bridge";
import { ITEM_KIND_LABELS } from "@/shared/orderLabels";

const INPUT =
  "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

interface Props {
  orderId: number;
  onClose: () => void;
  onAdded: () => void;
}

const ITEM_KINDS: ItemKind[] = ["book", "print", "service", "extra"];

export function AddItemPanel({ orderId, onClose, onAdded }: Props) {
  const [kind, setKind] = useState<ItemKind>("book");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-20 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 mb-10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">Добавить позицию</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            &times;
          </button>
        </div>

        {/* Kind selector */}
        <div className="flex gap-1 px-5 pt-4">
          {ITEM_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                kind === k
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {ITEM_KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="p-5">
          {kind === "book" && (
            <BookForm orderId={orderId} onClose={onClose} onAdded={onAdded} />
          )}
          {kind === "print" && (
            <PrintForm orderId={orderId} onClose={onClose} onAdded={onAdded} />
          )}
          {kind === "service" && (
            <ServiceForm orderId={orderId} onClose={onClose} onAdded={onAdded} />
          )}
          {kind === "extra" && (
            <ExtraForm orderId={orderId} onClose={onClose} onAdded={onAdded} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Print categories ─────────────────────────────────────────────────

const PRINT_CATEGORIES = [
  { value: "lab_print", label: "Фотопечать", unit: "шт." },
  { value: "wide_format_print", label: "Широкоформатная печать", unit: "пог. м" },
  { value: "wide_format_lamination", label: "Ламинация широкоформатная", unit: "кв. м" },
  { value: "photo_lamination", label: "Ламинация фото", unit: "шт." },
  { value: "photo_magnet", label: "Фото на магните", unit: "шт." },
  { value: "photo_pvc", label: "Фото на ПВХ", unit: "шт." },
  { value: "dsp_picture", label: "Картина на ДСП", unit: "шт." },
  { value: "canvas_stretched", label: "Холст на подрамнике", unit: "шт." },
  { value: "calendar_double_sided", label: "Двухсторонний календарь", unit: "шт." },
] as const;

const WIDE_FORMAT_MATERIALS = [
  "Фотобумага матовая 106 см / самоклейка",
  "Холст, ширина 60 см",
  "Холст, ширина 90 см",
];

const WIDE_FORMAT_LAMINATION_TYPES = [
  "Матовая",
  "Глянцевая",
  "Лён",
  "Алмазная",
];

// Categories that use format selector
const FORMAT_CATEGORIES = [
  "lab_print", "photo_lamination", "photo_magnet", "photo_pvc",
  "dsp_picture", "canvas_stretched", "calendar_double_sided",
];

// ── Book form ────────────────────────────────────────────────────────

const ASSEMBLY_KINDS = [
  { value: "plastic", label: "Пластик" },
  { value: "pvc_board", label: "Картон PVC" },
];

const COVER_FAMILIES = [
  { value: "laminated_hard", label: "Ламинированная твёрдая" },
  { value: "eco_leather", label: "Экокожа" },
];

const COVER_OPTIONS_LIST = [
  "Гравировка",
  "Фото-вставка",
];

function BookForm({
  orderId,
  onClose,
  onAdded,
}: {
  orderId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { data: formats } = useTauriCommand(catalogs.bookFormats);

  const [formatId, setFormatId] = useState<number | "">("");
  const [spreadCount, setSpreadCount] = useState(10);
  const [assemblyKind, setAssemblyKind] = useState("plastic");
  const [coverFamily, setCoverFamily] = useState("laminated_hard");
  const [coverOptions, setCoverOptions] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [manualPrice, setManualPrice] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleCoverOption = (opt: string) => {
    setCoverOptions((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const submit = async () => {
    if (!formatId) {
      toast.error("Выберите формат");
      return;
    }
    if (manualPrice && !manualReason) {
      toast.error("Укажите причину ручной цены");
      return;
    }
    setSubmitting(true);
    try {
      await orderItems.addBook({
        order_id: orderId,
        book_format_id: formatId as number,
        spread_count: spreadCount,
        assembly_kind: assemblyKind,
        cover_family: coverFamily,
        cover_options: coverOptions.length > 0 ? coverOptions : null,
        qty,
        manual_price: manualPrice ? Number(manualPrice) : null,
        manual_price_reason: manualReason || null,
      });
      toast.success("Книга добавлена");
      onAdded();
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Формат *</label>
          <select value={formatId} onChange={(e) => setFormatId(e.target.value ? Number(e.target.value) : "")} className={INPUT}>
            <option value="">—</option>
            {(formats ?? []).map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Разворотов</label>
          <input type="number" min={1} value={spreadCount} onChange={(e) => setSpreadCount(Number(e.target.value))} className={INPUT} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Тип сборки *</label>
          <select value={assemblyKind} onChange={(e) => setAssemblyKind(e.target.value)} className={INPUT}>
            {ASSEMBLY_KINDS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Обложка *</label>
          <select value={coverFamily} onChange={(e) => setCoverFamily(e.target.value)} className={INPUT}>
            {COVER_FAMILIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {coverFamily === "eco_leather" && (
        <div>
          <label className="block text-sm font-medium mb-1">Доп. опции обложки</label>
          <div className="flex gap-3">
            {COVER_OPTIONS_LIST.map((opt) => (
              <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={coverOptions.includes(opt)}
                  onChange={() => toggleCoverOption(opt)}
                  className="rounded border-gray-300"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Количество *</label>
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT + " w-24"} />
      </div>

      <div className="border-t border-gray-100 pt-3 mt-3">
        <p className="text-xs text-gray-500 mb-2">Ручная цена (оставьте пустым для авторасчёта)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <input type="number" step="0.01" placeholder="Цена за ед." value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} className={INPUT} />
          </div>
          <div>
            <input placeholder="Причина" value={manualReason} onChange={(e) => setManualReason(e.target.value)} className={INPUT} />
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
          {submitting ? "..." : "Добавить"}
        </button>
        <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── Print form ───────────────────────────────────────────────────────

function PrintForm({
  orderId,
  onClose,
  onAdded,
}: {
  orderId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { data: formats } = useTauriCommand(catalogs.printFormats);

  const [category, setCategory] = useState("lab_print");
  const [formatId, setFormatId] = useState<number | "">("");
  const [wideFormatMaterial, setWideFormatMaterial] = useState("");
  const [laminationType, setLaminationType] = useState("");
  const [qty, setQty] = useState(1);
  const [manualPrice, setManualPrice] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const needsFormat = FORMAT_CATEGORIES.includes(category);
  const catInfo = PRINT_CATEGORIES.find((c) => c.value === category);

  const submit = async () => {
    if (needsFormat && !formatId) {
      toast.error("Выберите формат");
      return;
    }
    if (category === "wide_format_print" && !wideFormatMaterial) {
      toast.error("Выберите материал");
      return;
    }
    if (category === "wide_format_lamination" && !laminationType) {
      toast.error("Выберите тип ламинации");
      return;
    }
    if (manualPrice && !manualReason) {
      toast.error("Укажите причину ручной цены");
      return;
    }
    setSubmitting(true);
    try {
      await orderItems.addPrint({
        order_id: orderId,
        category,
        print_format_id: needsFormat && formatId ? (formatId as number) : null,
        wide_format_material: category === "wide_format_print" ? wideFormatMaterial : null,
        lamination_type: category === "wide_format_lamination" ? laminationType : null,
        qty,
        manual_price: manualPrice ? Number(manualPrice) : null,
        manual_price_reason: manualReason || null,
      });
      toast.success("Позиция добавлена");
      onAdded();
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Категория *</label>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setFormatId(""); setWideFormatMaterial(""); setLaminationType(""); }} className={INPUT}>
          {PRINT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {needsFormat && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Формат *</label>
            <select value={formatId} onChange={(e) => setFormatId(e.target.value ? Number(e.target.value) : "")} className={INPUT}>
              <option value="">—</option>
              {(formats ?? []).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Кол-во ({catInfo?.unit ?? "шт."}) *</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT} />
          </div>
        </div>
      )}

      {category === "wide_format_print" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Материал *</label>
            <select value={wideFormatMaterial} onChange={(e) => setWideFormatMaterial(e.target.value)} className={INPUT}>
              <option value="">—</option>
              {WIDE_FORMAT_MATERIALS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Кол-во (пог. м) *</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT} />
          </div>
        </div>
      )}

      {category === "wide_format_lamination" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Тип ламинации *</label>
            <select value={laminationType} onChange={(e) => setLaminationType(e.target.value)} className={INPUT}>
              <option value="">—</option>
              {WIDE_FORMAT_LAMINATION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Кол-во (кв. м) *</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT} />
          </div>
        </div>
      )}

      <div className="border-t border-gray-100 pt-3 mt-3">
        <p className="text-xs text-gray-500 mb-2">Ручная цена (оставьте пустым для авторасчёта)</p>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" step="0.01" placeholder="Цена за ед." value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} className={INPUT} />
          <input placeholder="Причина" value={manualReason} onChange={(e) => setManualReason(e.target.value)} className={INPUT} />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
          {submitting ? "..." : "Добавить"}
        </button>
        <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── Service form ─────────────────────────────────────────────────────

function ServiceForm({
  orderId,
  onClose,
  onAdded,
}: {
  orderId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [description, setDescription] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!description.trim()) {
      toast.error("Введите описание услуги");
      return;
    }
    if (!unitPrice || Number(unitPrice) <= 0) {
      toast.error("Укажите цену");
      return;
    }
    setSubmitting(true);
    try {
      await orderItems.addService({
        order_id: orderId,
        description: description.trim(),
        qty,
        unit_price: Number(unitPrice),
      });
      toast.success("Услуга добавлена");
      onAdded();
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Описание *</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Фотосессия, ретушь и т.д." className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Количество</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Цена за ед. *</label>
          <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={INPUT} />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
          {submitting ? "..." : "Добавить"}
        </button>
        <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── Extra form ───────────────────────────────────────────────────────

function ExtraForm({
  orderId,
  onClose,
  onAdded,
}: {
  orderId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { data: extraTypes } = useTauriCommand(catalogs.extraOptionTypes);
  const [extraTypeId, setExtraTypeId] = useState<number | "">("");
  const [customName, setCustomName] = useState("");
  const [qty, setQty] = useState(1);
  const [unitPrice, setUnitPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill price from selected extra type
  const selectedExtra = extraTypes?.find((e) => e.id === extraTypeId);

  const submit = async () => {
    if (!extraTypeId && !customName.trim()) {
      toast.error("Выберите опцию или введите название");
      return;
    }
    setSubmitting(true);
    try {
      await orderItems.addExtra({
        order_id: orderId,
        extra_option_type_id: extraTypeId || null,
        custom_name: customName.trim() || null,
        qty,
        unit_price: unitPrice ? Number(unitPrice) : null,
      });
      toast.success("Опция добавлена");
      onAdded();
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Опция из каталога</label>
        <select value={extraTypeId} onChange={(e) => setExtraTypeId(e.target.value ? Number(e.target.value) : "")} className={INPUT}>
          <option value="">— Или введите своё название ниже —</option>
          {(extraTypes ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {e.default_price != null ? ` (${e.default_price} ₸)` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Или своё название</label>
        <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Название опции" className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Количество</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Цена за ед.</label>
          <input
            type="number"
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder={selectedExtra?.default_price != null ? String(selectedExtra.default_price) : ""}
            className={INPUT}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
          {submitting ? "..." : "Добавить"}
        </button>
        <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">
          Отмена
        </button>
      </div>
    </div>
  );
}

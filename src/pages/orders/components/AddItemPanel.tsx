import { useState } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  catalogs,
  orderItems,
  type ItemKind,
  type OrderItem,
} from "@/infrastructure/tauri-bridge";
import { ITEM_KIND_LABELS, formatMoney } from "@/shared/orderLabels";

const INPUT =
  "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

interface Props {
  orderId: number;
  editItem?: OrderItem;
  onClose: () => void;
  onAdded: () => void;
}

const ITEM_KINDS: ItemKind[] = ["book", "print", "service", "extra"];

export function AddItemPanel({ orderId, editItem, onClose, onAdded }: Props) {
  const isEdit = !!editItem;
  const [kind, setKind] = useState<ItemKind>(editItem?.item_kind ?? "book");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-20 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 mb-10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">
            {isEdit ? "Редактировать позицию" : "Добавить позицию"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            &times;
          </button>
        </div>

        {/* Kind selector — locked when editing */}
        <div className="flex gap-1 px-5 pt-4">
          {ITEM_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => !isEdit && setKind(k)}
              disabled={isEdit && k !== kind}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                kind === k
                  ? "bg-blue-600 text-white"
                  : isEdit
                    ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {ITEM_KIND_LABELS[k]}
            </button>
          ))}
        </div>

        <div className="p-5">
          {kind === "book" && (
            <BookForm orderId={orderId} editItem={editItem} onClose={onClose} onAdded={onAdded} />
          )}
          {kind === "print" && (
            <PrintForm orderId={orderId} editItem={editItem} onClose={onClose} onAdded={onAdded} />
          )}
          {kind === "service" && (
            <ServiceForm orderId={orderId} editItem={editItem} onClose={onClose} onAdded={onAdded} />
          )}
          {kind === "extra" && (
            <ExtraForm orderId={orderId} editItem={editItem} onClose={onClose} onAdded={onAdded} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared edit fields (qty + price) for book/print ─────────────────

function EditFields({
  editItem,
  onClose,
  onAdded,
}: {
  editItem: OrderItem;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [qty, setQty] = useState(editItem.qty);
  const [unitPrice, setUnitPrice] = useState(String(editItem.unit_price));
  const [reason, setReason] = useState(editItem.manual_price_reason ?? "");
  const [submitting, setSubmitting] = useState(false);

  const priceChanged = Number(unitPrice) !== editItem.unit_price;
  const total = qty * Number(unitPrice);

  const submit = async () => {
    if (priceChanged && !reason.trim()) {
      toast.error("Укажите причину изменения цены");
      return;
    }
    const input: Record<string, unknown> = {};
    if (qty !== editItem.qty) input.qty = qty;
    if (priceChanged) {
      input.unit_price = Number(unitPrice);
      input.manual_price_reason = reason;
    }
    if (Object.keys(input).length === 0) { onClose(); return; }

    setSubmitting(true);
    try {
      await orderItems.update(editItem.id, input);
      toast.success("Позиция обновлена");
      onAdded();
      onClose();
    } catch (err) { toast.error(String(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">{editItem.description || "—"}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Количество</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Цена за ед.</label>
          <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={INPUT} />
        </div>
      </div>
      {priceChanged && (
        <div>
          <label className="block text-sm font-medium mb-1">Причина изменения цены *</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Скидка, доплата и т.д." className={INPUT} />
        </div>
      )}
      <div className="text-sm font-mono text-right text-gray-600">
        Итого: <span className="font-medium text-gray-900">{formatMoney(total)} ₸</span>
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
          {submitting ? "..." : "Сохранить"}
        </button>
        <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">
          Отмена
        </button>
      </div>
    </div>
  );
}

// ── Book form ────────────────────────────────────────────────────────

function BookForm({
  orderId, editItem, onClose, onAdded,
}: {
  orderId: number;
  editItem?: OrderItem;
  onClose: () => void;
  onAdded: () => void;
}) {
  // Edit mode: show only qty + price
  if (editItem) {
    return <EditFields editItem={editItem} onClose={onClose} onAdded={onAdded} />;
  }

  return <BookAddForm orderId={orderId} onClose={onClose} onAdded={onAdded} />;
}

function BookAddForm({
  orderId, onClose, onAdded,
}: {
  orderId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { data: formats } = useTauriCommand(catalogs.bookFormats);
  const { data: assemblyKinds } = useTauriCommand(catalogs.assemblyKinds);
  const { data: coverFamilies } = useTauriCommand(catalogs.coverFamilies);
  const { data: coverOptionsList } = useTauriCommand(catalogs.bookCoverOptions);

  const [formatId, setFormatId] = useState<number | "">("");
  const [spreadCount, setSpreadCount] = useState(1);
  const [assemblyKind, setAssemblyKind] = useState("");
  const [coverFamily, setCoverFamily] = useState("");
  const [coverOptions, setCoverOptions] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [manualPrice, setManualPrice] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!assemblyKind && assemblyKinds?.length) setAssemblyKind(assemblyKinds[0].code);
  if (!coverFamily && coverFamilies?.length) setCoverFamily(coverFamilies[0].code);

  const toggleCoverOption = (opt: string) => {
    setCoverOptions((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const submit = async () => {
    if (!formatId) { toast.error("Выберите формат"); return; }
    if (manualPrice && !manualReason) { toast.error("Укажите причину ручной цены"); return; }
    setSubmitting(true);
    try {
      await orderItems.addBook({
        order_id: orderId,
        book_format_id: formatId as number,
        spread_count: spreadCount,
        assembly_kind: assemblyKind || null,
        cover_family: coverFamily || null,
        cover_options: coverOptions.length > 0 ? coverOptions : null,
        qty,
        manual_price: manualPrice ? Number(manualPrice) : null,
        manual_price_reason: manualReason || null,
      });
      toast.success("Книга добавлена");
      onAdded();
      onClose();
    } catch (err) { toast.error(String(err)); }
    finally { setSubmitting(false); }
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
            {(assemblyKinds ?? []).map((a) => (
              <option key={a.code} value={a.code}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Обложка *</label>
          <select value={coverFamily} onChange={(e) => setCoverFamily(e.target.value)} className={INPUT}>
            {(coverFamilies ?? []).map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {(coverOptionsList ?? []).length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-1">Доп. опции обложки</label>
          <div className="flex gap-3 flex-wrap">
            {(coverOptionsList ?? []).map((opt) => (
              <label key={opt.name} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={coverOptions.includes(opt.name)} onChange={() => toggleCoverOption(opt.name)} className="rounded border-gray-300" />
                {opt.name}
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

// ── Print form ───────────────────────────────────────────────────────

function PrintForm({
  orderId, editItem, onClose, onAdded,
}: {
  orderId: number;
  editItem?: OrderItem;
  onClose: () => void;
  onAdded: () => void;
}) {
  if (editItem) {
    return <EditFields editItem={editItem} onClose={onClose} onAdded={onAdded} />;
  }

  return <PrintAddForm orderId={orderId} onClose={onClose} onAdded={onAdded} />;
}

function PrintAddForm({
  orderId, onClose, onAdded,
}: {
  orderId: number;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { data: formats } = useTauriCommand(catalogs.printFormats);
  const { data: printCategories } = useTauriCommand(catalogs.printCategories);
  const { data: wfMaterials } = useTauriCommand(catalogs.wideFormatMaterials);
  const { data: laminationTypes } = useTauriCommand(catalogs.laminationTypes);

  const [category, setCategory] = useState("");
  const [formatId, setFormatId] = useState<number | "">("");
  const [wideFormatMaterial, setWideFormatMaterial] = useState("");
  const [laminationType, setLaminationType] = useState("");
  const [qty, setQty] = useState(1);
  const [manualPrice, setManualPrice] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!category && printCategories?.length) setCategory(printCategories[0].code);

  const catInfo = printCategories?.find((c) => c.code === category);
  const fieldType = catInfo?.field_type ?? "format";

  const submit = async () => {
    if (fieldType === "format" && !formatId) { toast.error("Выберите формат"); return; }
    if (fieldType === "material" && !wideFormatMaterial) { toast.error("Выберите материал"); return; }
    if (fieldType === "lamination" && !laminationType) { toast.error("Выберите тип ламинации"); return; }
    if (manualPrice && !manualReason) { toast.error("Укажите причину ручной цены"); return; }
    setSubmitting(true);
    try {
      await orderItems.addPrint({
        order_id: orderId,
        category,
        print_format_id: fieldType === "format" && formatId ? (formatId as number) : null,
        wide_format_material: fieldType === "material" ? wideFormatMaterial : null,
        lamination_type: fieldType === "lamination" ? laminationType : null,
        qty,
        manual_price: manualPrice ? Number(manualPrice) : null,
        manual_price_reason: manualReason || null,
      });
      toast.success("Позиция добавлена");
      onAdded();
      onClose();
    } catch (err) { toast.error(String(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1">Категория *</label>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setFormatId(""); setWideFormatMaterial(""); setLaminationType(""); }} className={INPUT}>
          {(printCategories ?? []).map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>

      {fieldType === "format" && (
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

      {fieldType === "material" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Материал *</label>
            <select value={wideFormatMaterial} onChange={(e) => setWideFormatMaterial(e.target.value)} className={INPUT}>
              <option value="">—</option>
              {(wfMaterials ?? []).map((m) => (
                <option key={m.id} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Кол-во ({catInfo?.unit ?? "пог. м"}) *</label>
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT} />
          </div>
        </div>
      )}

      {fieldType === "lamination" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Тип ламинации *</label>
            <select value={laminationType} onChange={(e) => setLaminationType(e.target.value)} className={INPUT}>
              <option value="">—</option>
              {(laminationTypes ?? []).map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Кол-во ({catInfo?.unit ?? "кв. м"}) *</label>
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
  orderId, editItem, onClose, onAdded,
}: {
  orderId: number;
  editItem?: OrderItem;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [description, setDescription] = useState(editItem?.description ?? "");
  const [qty, setQty] = useState(editItem?.qty ?? 1);
  const [unitPrice, setUnitPrice] = useState(editItem ? String(editItem.unit_price) : "");
  const [reason, setReason] = useState(editItem?.manual_price_reason ?? "");
  const [submitting, setSubmitting] = useState(false);

  const isEdit = !!editItem;
  const priceChanged = isEdit && Number(unitPrice) !== editItem.unit_price;

  const submit = async () => {
    if (!description.trim()) { toast.error("Введите описание услуги"); return; }
    if (!unitPrice || Number(unitPrice) <= 0) { toast.error("Укажите цену"); return; }

    if (isEdit) {
      if (priceChanged && !reason.trim()) { toast.error("Укажите причину изменения цены"); return; }
      const input: Record<string, unknown> = {};
      if (qty !== editItem.qty) input.qty = qty;
      if (description !== (editItem.description ?? "")) input.description = description;
      if (priceChanged) {
        input.unit_price = Number(unitPrice);
        input.manual_price_reason = reason;
      }
      if (Object.keys(input).length === 0) { onClose(); return; }
      setSubmitting(true);
      try {
        await orderItems.update(editItem.id, input);
        toast.success("Позиция обновлена");
        onAdded();
        onClose();
      } catch (err) { toast.error(String(err)); }
      finally { setSubmitting(false); }
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
    } catch (err) { toast.error(String(err)); }
    finally { setSubmitting(false); }
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
      {isEdit && priceChanged && (
        <div>
          <label className="block text-sm font-medium mb-1">Причина изменения цены *</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Скидка, доплата и т.д." className={INPUT} />
        </div>
      )}
      {(qty > 0 && Number(unitPrice) > 0) && (
        <div className="text-sm font-mono text-right text-gray-600">
          Итого: <span className="font-medium text-gray-900">{formatMoney(qty * Number(unitPrice))} ₸</span>
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
          {submitting ? "..." : isEdit ? "Сохранить" : "Добавить"}
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
  orderId, editItem, onClose, onAdded,
}: {
  orderId: number;
  editItem?: OrderItem;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { data: extraTypes } = useTauriCommand(catalogs.extraOptionTypes);
  const isEdit = !!editItem;

  const [extraTypeId, setExtraTypeId] = useState<number | "">("");
  const [customName, setCustomName] = useState(editItem?.description ?? "");
  const [qty, setQty] = useState(editItem?.qty ?? 1);
  const [unitPrice, setUnitPrice] = useState(editItem ? String(editItem.unit_price) : "");
  const [reason, setReason] = useState(editItem?.manual_price_reason ?? "");
  const [submitting, setSubmitting] = useState(false);

  const selectedExtra = extraTypes?.find((e) => e.id === extraTypeId);
  const priceChanged = isEdit && Number(unitPrice) !== editItem.unit_price;

  const submit = async () => {
    if (isEdit) {
      if (priceChanged && !reason.trim()) { toast.error("Укажите причину изменения цены"); return; }
      const input: Record<string, unknown> = {};
      if (qty !== editItem.qty) input.qty = qty;
      if (customName !== (editItem.description ?? "")) input.description = customName;
      if (priceChanged) {
        input.unit_price = Number(unitPrice);
        input.manual_price_reason = reason;
      }
      if (Object.keys(input).length === 0) { onClose(); return; }
      setSubmitting(true);
      try {
        await orderItems.update(editItem.id, input);
        toast.success("Позиция обновлена");
        onAdded();
        onClose();
      } catch (err) { toast.error(String(err)); }
      finally { setSubmitting(false); }
      return;
    }

    if (!extraTypeId && !customName.trim()) { toast.error("Выберите опцию или введите название"); return; }
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
    } catch (err) { toast.error(String(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3">
      {!isEdit && (
        <div>
          <label className="block text-sm font-medium mb-1">Опция из каталога</label>
          <select value={extraTypeId} onChange={(e) => setExtraTypeId(e.target.value ? Number(e.target.value) : "")} className={INPUT}>
            <option value="">— Или введите своё название ниже —</option>
            {(extraTypes ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}{e.default_price != null ? ` (${e.default_price} ₸)` : ""}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-sm font-medium mb-1">{isEdit ? "Название" : "Или своё название"}</label>
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
            type="number" step="0.01" value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder={selectedExtra?.default_price != null ? String(selectedExtra.default_price) : ""}
            className={INPUT}
          />
        </div>
      </div>
      {isEdit && priceChanged && (
        <div>
          <label className="block text-sm font-medium mb-1">Причина изменения цены *</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Скидка, доплата и т.д." className={INPUT} />
        </div>
      )}
      <div className="flex gap-2 pt-2">
        <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
          {submitting ? "..." : isEdit ? "Сохранить" : "Добавить"}
        </button>
        <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">
          Отмена
        </button>
      </div>
    </div>
  );
}

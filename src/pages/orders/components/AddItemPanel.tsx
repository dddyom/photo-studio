import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  catalogs,
  orderItems,
  pricing,
  type ItemKind,
  type OrderItem,
} from "@/infrastructure/tauri-bridge";
import { ITEM_KIND_LABELS, formatMoney, CURRENCY_SYMBOL } from "@/shared/orderLabels";

const INPUT =
  "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

interface Props {
  orderId: number;
  pricingProgramId: number | null;
  editItem?: OrderItem;
  onClose: () => void;
  onAdded: () => void;
}

const ITEM_KINDS: ItemKind[] = ["print", "book", "service", "extra"];

export function AddItemPanel({ orderId, pricingProgramId, editItem, onClose, onAdded }: Props) {
  const isEdit = !!editItem;
  const [kind, setKind] = useState<ItemKind>(editItem?.item_kind ?? "print");

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
            <BookForm orderId={orderId} pricingProgramId={pricingProgramId} editItem={editItem} onClose={onClose} onAdded={onAdded} />
          )}
          {kind === "print" && (
            <PrintForm orderId={orderId} pricingProgramId={pricingProgramId} editItem={editItem} onClose={onClose} onAdded={onAdded} />
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
  orderId, pricingProgramId, editItem, onClose, onAdded,
}: {
  orderId: number;
  pricingProgramId: number | null;
  editItem?: OrderItem;
  onClose: () => void;
  onAdded: () => void;
}) {
  // Edit mode: show only qty + price
  if (editItem) {
    return <EditFields editItem={editItem} onClose={onClose} onAdded={onAdded} />;
  }

  return <BookAddForm orderId={orderId} pricingProgramId={pricingProgramId} onClose={onClose} onAdded={onAdded} />;
}

function BookAddForm({
  orderId, pricingProgramId, onClose, onAdded,
}: {
  orderId: number;
  pricingProgramId: number | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { data: formats } = useTauriCommand(catalogs.bookFormats);
  const { data: assemblyKinds } = useTauriCommand(catalogs.assemblyKinds);
  const { data: coverFamilies } = useTauriCommand(catalogs.coverFamilies);
  const { data: coverOptionsList } = useTauriCommand(catalogs.bookCoverOptions);
  const { data: popularFormats } = useTauriCommand(catalogs.popularBookFormats);

  const [formatId, setFormatId] = useState<number | "">("");
  const [spreadCount, setSpreadCount] = useState(10);
  const [assemblyKind, setAssemblyKind] = useState("");
  const [coverFamily, setCoverFamily] = useState("");
  const [coverOptions, setCoverOptions] = useState<string[]>([]);
  const [multiCoverOptions, setMultiCoverOptions] = useState(false);
  const [qty, setQty] = useState(1);
  const [manualPrice, setManualPrice] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [previewTotal, setPreviewTotal] = useState<number | null>(null);
  const [blockPrices, setBlockPrices] = useState<Map<string, number>>(new Map());
  const [coverPrices, setCoverPrices] = useState<Map<string, number>>(new Map());
  const [optionPrices, setOptionPrices] = useState<Map<string, number>>(new Map());

  if (!assemblyKind && assemblyKinds?.length) setAssemblyKind(assemblyKinds[0].code);
  if (!coverFamily && coverFamilies?.length) setCoverFamily(coverFamilies[0].code);

  const familyCoverOptions = (coverOptionsList ?? []).filter(
    (o) => o.cover_family_codes.length === 0 || o.cover_family_codes.includes(coverFamily)
  );

  const selectedFormatName = formats?.find((f) => f.id === formatId)?.name;

  // Fetch book prices (block per format, cover per format, options)
  useEffect(() => {
    if (!pricingProgramId || !assemblyKind || !formats) return;
    let cancelled = false;
    const formatNames = formats.map((f) => f.name);
    const optNames = (coverOptionsList ?? []).map((o) => o.name);

    pricing.listBookPrices({
      pricing_program_id: pricingProgramId,
      assembly_kind: assemblyKind,
      cover_family: coverFamily,
      format_names: formatNames,
      cover_option_names: optNames,
    }).then((r) => {
      if (cancelled) return;
      const bp = new Map<string, number>();
      for (const e of r.block_per_spread) bp.set(e.value, e.unit_price);
      setBlockPrices(bp);
      const cp = new Map<string, number>();
      for (const e of r.cover) cp.set(e.value, e.unit_price);
      setCoverPrices(cp);
      const op = new Map<string, number>();
      for (const e of r.cover_options) op.set(e.value, e.unit_price);
      setOptionPrices(op);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [pricingProgramId, assemblyKind, coverFamily, formats, coverOptionsList]);

  // Live total preview
  useEffect(() => {
    if (!pricingProgramId || !formatId || !selectedFormatName || !assemblyKind) {
      setPreviewTotal(null);
      return;
    }
    let cancelled = false;
    const spec: Record<string, unknown> = {
      format: selectedFormatName,
      spread_count: spreadCount,
      assembly_kind: assemblyKind,
    };
    if (coverFamily) spec.cover_family = coverFamily;
    if (coverOptions.length > 0) spec.cover_options = coverOptions;

    pricing.previewPrice({
      pricing_program_id: pricingProgramId,
      item_kind: "book",
      spec_json: JSON.stringify(spec),
      qty,
    }).then((r) => { if (!cancelled) setPreviewTotal(r.total_price); })
      .catch(() => { if (!cancelled) setPreviewTotal(null); });
    return () => { cancelled = true; };
  }, [pricingProgramId, formatId, selectedFormatName, spreadCount, assemblyKind, coverFamily, coverOptions, qty]);

  const toggleCoverOption = (opt: string) => {
    if (multiCoverOptions) {
      setCoverOptions((prev) =>
        prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
      );
    } else {
      setCoverOptions((prev) => prev.includes(opt) ? [] : [opt]);
    }
  };

  // Sort book formats: most-ordered first, then rest
  type FmtItem = { id: number; name: string };
  const sortedBookFormats = useMemo(() => {
    const empty = { popular: [] as FmtItem[], rest: [] as FmtItem[] };
    if (!formats) return empty;
    if (!popularFormats || popularFormats.length === 0) return { popular: [] as FmtItem[], rest: formats };
    const topNames = popularFormats.slice(0, MAX_POPULAR).map((p) => p.name);
    const popular = topNames
      .map((name) => formats.find((f) => f.name === name))
      .filter((f): f is NonNullable<typeof f> => f != null);
    const popularIds = new Set(popular.map((f) => f.id));
    const rest = formats.filter((f) => !popularIds.has(f.id));
    return { popular, rest };
  }, [formats, popularFormats]);

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
        note: note.trim() || null,
      });
      toast.success("Книга добавлена");
      onAdded();
      onClose();
    } catch (err) { toast.error(String(err)); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-3">
      {/* Assembly kind — buttons */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Тип сборки *</label>
        <div className="flex flex-wrap gap-1.5">
          {(assemblyKinds ?? []).map((a) => (
            <button key={a.code} type="button" onClick={() => setAssemblyKind(a.code)}
              className={`px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
                assemblyKind === a.code ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Format — grid with prices */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Формат *</label>
        {sortedBookFormats.popular.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {sortedBookFormats.popular.map((f) => {
              const price = blockPrices.get(f.name);
              const selected = formatId === f.id;
              return (
                <button key={f.id} type="button" onClick={() => setFormatId(f.id)}
                  className={`px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
                    selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <span className="font-medium">{f.name}</span>
                  {price != null && <span className="text-gray-400 ml-1 text-xs">{formatMoney(price)} {CURRENCY_SYMBOL}/разв.</span>}
                </button>
              );
            })}
          </div>
        )}
        {sortedBookFormats.rest.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sortedBookFormats.rest.map((f) => {
              const price = blockPrices.get(f.name);
              const selected = formatId === f.id;
              return (
                <button key={f.id} type="button" onClick={() => setFormatId(f.id)}
                  className={`px-2 py-1 rounded text-xs border transition-colors ${
                    selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  {f.name}
                  {price != null && <span className="text-gray-400 ml-1">{formatMoney(price)}/разв.</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Spread count + qty */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Разворотов</label>
          <input type="number" min={1} value={spreadCount} onChange={(e) => setSpreadCount(Number(e.target.value))} className={INPUT} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Количество *</label>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT} />
        </div>
      </div>

      {/* Cover family — buttons with prices */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Обложка</label>
        <div className="flex flex-wrap gap-1.5">
          {(coverFamilies ?? []).map((c) => {
            const price = selectedFormatName && c.code !== "plain" ? coverPrices.get(selectedFormatName) : undefined;
            const selected = coverFamily === c.code;
            return (
              <button key={c.code} type="button" onClick={() => { setCoverFamily(c.code); setCoverOptions([]); }}
                className={`px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
                  selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                {c.name}
                {price != null && <span className="text-gray-400 ml-1 text-xs">+{formatMoney(price)} {CURRENCY_SYMBOL}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cover options (scoped to current cover family) */}
      {familyCoverOptions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium">Доп. опции обложки</label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={multiCoverOptions}
                onChange={(e) => {
                  setMultiCoverOptions(e.target.checked);
                  if (!e.target.checked && coverOptions.length > 1) setCoverOptions(coverOptions.slice(0, 1));
                }}
                className="rounded border-gray-300"
              />
              Несколько
            </label>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {familyCoverOptions.map((opt) => {
              const price = optionPrices.get(opt.name);
              const checked = coverOptions.includes(opt.name);
              return (
                <button key={opt.name} type="button" onClick={() => toggleCoverOption(opt.name)}
                  className={`px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
                    checked ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  {opt.name}
                  {price != null && <span className="text-gray-400 ml-1 text-xs">+{formatMoney(price)} {CURRENCY_SYMBOL}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {previewTotal != null && !manualPrice && (
        <div className="text-sm font-mono text-right text-gray-600">
          Итого: <span className="font-medium text-gray-900">{formatMoney(previewTotal)} {CURRENCY_SYMBOL}</span>
        </div>
      )}

      <div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий к позиции" className={INPUT} />
      </div>

      <div className="border-t border-gray-100 pt-3 mt-3">
        <p className="text-xs text-gray-500 mb-2">Ручная цена (оставьте пустым для авторасчёта)</p>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" step="0.01" placeholder="Цена за ед." value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} className={INPUT} />
          <input placeholder="Причина" value={manualReason} onChange={(e) => setManualReason(e.target.value)} className={INPUT} />
        </div>
      </div>

      {manualPrice && (
        <div className="text-sm font-mono text-right text-gray-600">
          Итого: <span className="font-medium text-gray-900">{formatMoney(Number(manualPrice) * qty)} {CURRENCY_SYMBOL}</span>
        </div>
      )}

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
  orderId, pricingProgramId, editItem, onClose, onAdded,
}: {
  orderId: number;
  pricingProgramId: number | null;
  editItem?: OrderItem;
  onClose: () => void;
  onAdded: () => void;
}) {
  if (editItem) {
    return <EditFields editItem={editItem} onClose={onClose} onAdded={onAdded} />;
  }

  return <PrintAddForm orderId={orderId} pricingProgramId={pricingProgramId} onClose={onClose} onAdded={onAdded} />;
}

const MAX_POPULAR = 5;

function PrintAddForm({
  orderId, pricingProgramId, onClose, onAdded,
}: {
  orderId: number;
  pricingProgramId: number | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { data: formats } = useTauriCommand(catalogs.printFormats);
  const { data: printCategories } = useTauriCommand(catalogs.printCategories);
  const { data: wfMaterials } = useTauriCommand(catalogs.wideFormatMaterials);
  const { data: laminationTypes } = useTauriCommand(catalogs.laminationTypes);
  const { data: popularFormats } = useTauriCommand(catalogs.popularPrintFormats);
  const { data: popularCategories } = useTauriCommand(catalogs.popularPrintCategories);

  const sortedCategories = useMemo(() => {
    if (!printCategories) return [];
    if (!popularCategories || popularCategories.length === 0) return printCategories;
    const order = new Map<string, number>();
    popularCategories.forEach((p, i) => order.set(p.name, i));
    return [...printCategories].sort((a, b) => {
      const ra = order.get(a.code) ?? Number.MAX_SAFE_INTEGER;
      const rb = order.get(b.code) ?? Number.MAX_SAFE_INTEGER;
      if (ra !== rb) return ra - rb;
      return a.sort_order - b.sort_order;
    });
  }, [printCategories, popularCategories]);

  const [category, setCategory] = useState("");
  const [formatId, setFormatId] = useState<number | "">("");
  const [wideFormatMaterial, setWideFormatMaterial] = useState("");
  const [laminationType, setLaminationType] = useState("");
  const [qty, setQty] = useState(1);
  const [manualPrice, setManualPrice] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [prices, setPrices] = useState<Map<string, number>>(new Map());

  if (!category && sortedCategories.length) setCategory(sortedCategories[0].code);

  const catInfo = printCategories?.find((c) => c.code === category);
  const fieldType = catInfo?.field_type ?? "format";

  // Fetch prices for the current category
  useEffect(() => {
    if (!pricingProgramId || !category) return;
    let cancelled = false;

    const fieldKey = fieldType === "material" ? "material" : fieldType === "lamination" ? "lamination_type" : "format";
    const values: string[] = [];
    if (fieldType === "format" && formats) {
      formats.forEach((f) => values.push(f.name));
    } else if (fieldType === "material" && wfMaterials) {
      wfMaterials.forEach((m) => values.push(m.name));
    } else if (fieldType === "lamination" && laminationTypes) {
      laminationTypes.forEach((t) => values.push(t.name));
    }
    if (values.length === 0) return;

    pricing.listCategoryPrices({
      pricing_program_id: pricingProgramId,
      item_kind: "print",
      category,
      field_key: fieldKey,
      values,
    }).then((entries) => {
      if (cancelled) return;
      const m = new Map<string, number>();
      for (const e of entries) m.set(e.value, e.unit_price);
      setPrices(m);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [pricingProgramId, category, fieldType, formats, wfMaterials, laminationTypes]);

  // Sort formats: most-ordered first, then rest
  type FmtItem = { id: number; name: string };
  const sortedFormats = useMemo(() => {
    const empty = { popular: [] as FmtItem[], rest: [] as FmtItem[] };
    if (!formats) return empty;
    if (!popularFormats || popularFormats.length === 0) return { popular: [] as FmtItem[], rest: formats };
    const topNames = popularFormats.slice(0, MAX_POPULAR).map((p) => p.name);
    const popular = topNames
      .map((name) => formats.find((f) => f.name === name))
      .filter((f): f is NonNullable<typeof f> => f != null);
    const popularIds = new Set(popular.map((f) => f.id));
    const rest = formats.filter((f) => !popularIds.has(f.id));
    return { popular, rest };
  }, [formats, popularFormats]);

  // Selected format price
  const selectedFormat = formats?.find((f) => f.id === formatId);
  const selectedPrice = selectedFormat ? prices.get(selectedFormat.name) : undefined;
  const selectedMaterialPrice = wideFormatMaterial ? prices.get(wideFormatMaterial) : undefined;
  const selectedLamPrice = laminationType ? prices.get(laminationType) : undefined;
  const autoPrice = selectedPrice ?? selectedMaterialPrice ?? selectedLamPrice;
  const displayTotal = manualPrice ? Number(manualPrice) * qty : autoPrice ? autoPrice * qty : null;

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
        note: note.trim() || null,
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
        <select value={category} onChange={(e) => { setCategory(e.target.value); setFormatId(""); setWideFormatMaterial(""); setLaminationType(""); setPrices(new Map()); }} className={INPUT}>
          {sortedCategories.map((c) => (
            <option key={c.code} value={c.code}>{c.name}</option>
          ))}
        </select>
      </div>

      {fieldType === "format" && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Формат *</label>
          {/* Popular formats */}
          {sortedFormats.popular && sortedFormats.popular.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {sortedFormats.popular.map((f) => {
                const price = prices.get(f.name);
                const selected = formatId === f.id;
                return (
                  <button key={f.id} type="button" onClick={() => setFormatId(f.id)}
                    className={`px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
                      selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <span className="font-medium">{f.name}</span>
                    {price != null && <span className="text-gray-400 ml-1 text-xs">{formatMoney(price)} {CURRENCY_SYMBOL}</span>}
                  </button>
                );
              })}
            </div>
          )}
          {/* All other formats */}
          {sortedFormats.rest && sortedFormats.rest.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sortedFormats.rest.map((f) => {
                const price = prices.get(f.name);
                const selected = formatId === f.id;
                return (
                  <button key={f.id} type="button" onClick={() => setFormatId(f.id)}
                    className={`px-2 py-1 rounded text-xs border transition-colors ${
                      selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    {f.name}
                    {price != null && <span className="text-gray-400 ml-1">{formatMoney(price)}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {fieldType === "material" && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Материал *</label>
          <div className="space-y-1">
            {(wfMaterials ?? []).map((m) => {
              const price = prices.get(m.name);
              const selected = wideFormatMaterial === m.name;
              return (
                <button key={m.id} type="button" onClick={() => setWideFormatMaterial(m.name)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors flex justify-between ${
                    selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <span>{m.name}</span>
                  {price != null && <span className="text-gray-400">{formatMoney(price)} {CURRENCY_SYMBOL}/{catInfo?.unit ?? "пог. м"}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {fieldType === "lamination" && (
        <div>
          <label className="block text-sm font-medium mb-1.5">Тип ламинации *</label>
          <div className="flex flex-wrap gap-1.5">
            {(laminationTypes ?? []).map((t) => {
              const price = prices.get(t.name);
              const selected = laminationType === t.name;
              return (
                <button key={t.id} type="button" onClick={() => setLaminationType(t.name)}
                  className={`px-2.5 py-1.5 rounded-md text-sm border transition-colors ${
                    selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <span>{t.name}</span>
                  {price != null && <span className="text-gray-400 ml-1 text-xs">{formatMoney(price)} {CURRENCY_SYMBOL}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-1">Кол-во ({catInfo?.unit ?? "шт."}) *</label>
        <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className={INPUT + " w-24"} />
      </div>

      {displayTotal != null && (
        <div className="text-sm font-mono text-right text-gray-600">
          {autoPrice != null && !manualPrice && <span className="text-gray-400">{formatMoney(autoPrice)} × {qty} = </span>}
          Итого: <span className="font-medium text-gray-900">{formatMoney(displayTotal)} {CURRENCY_SYMBOL}</span>
        </div>
      )}

      <div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий к позиции" className={INPUT} />
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
  const [note, setNote] = useState("");
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
        note: note.trim() || null,
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
      {!isEdit && (
        <div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий к позиции" className={INPUT} />
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
  const [note, setNote] = useState("");
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
        note: note.trim() || null,
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
      {!isEdit && (
        <div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Комментарий к позиции" className={INPUT} />
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

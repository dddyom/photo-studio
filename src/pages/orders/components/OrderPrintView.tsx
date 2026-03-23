import { useRef, useEffect, useState } from "react";
import type {
  Order,
  OrderItem,
  OrderPayment,
} from "@/infrastructure/tauri-bridge";
import { system } from "@/infrastructure/tauri-bridge";
import { formatMoney, formatDate, ITEM_KIND_LABELS } from "@/shared/orderLabels";

interface Props {
  order: Order;
  items: OrderItem[];
  payments: OrderPayment[];
  type: "receipt";
  onClose: () => void;
}

export function OrderPrintView({ order, items, payments, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [companyName, setCompanyName] = useState("Фотостудия");

  useEffect(() => {
    system.getSettings().then((s) => setCompanyName(s.company_name));
  }, []);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;

    const html =
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Квитанция ${order.number}</title>` +
      `<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;padding:12mm 15mm;color:#222;line-height:1.5}@media print{body{padding:10mm}}</style>` +
      `</head><body>${el.innerHTML}</body></html>`;

    // Use hidden iframe — window.open is blocked in Tauri webview
    let iframe = document.getElementById("print-frame") as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-frame";
      iframe.style.position = "fixed";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.left = "-9999px";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe!.contentWindow?.print();
    }, 200);
  };

  const activeItems = items.filter((i) => !i.is_cancelled);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-10 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-xl mx-4 mb-10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">Квитанция</h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              Печать
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
          </div>
        </div>

        <div style={{ padding: "24px", fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 13, color: "#222", lineHeight: 1.5 }} ref={printRef}>
          {/* Header */}
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>{companyName}</div>
          <div style={{ color: "#888", fontSize: 12, marginBottom: 16 }}>Квитанция к заказу</div>

          {/* Info */}
          <table style={{ borderCollapse: "collapse", marginBottom: 16 }}>
            <tbody>
              <InfoRow label="Заказ №" value={order.number} bold />
              <InfoRow label="Дата" value={formatDate(order.created_at)} />
              <InfoRow label="Клиент" value={order.client_name ?? ""} />
              {order.due_date && <InfoRow label="Готовность" value={formatDate(order.due_date)} />}
            </tbody>
          </table>

          {/* Divider */}
          <div style={{ borderTop: "1px solid #ddd", margin: "12px 0" }} />

          {/* Items */}
          {activeItems.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}

          {/* Totals */}
          <div style={{ borderTop: "2px solid #333", marginTop: 16, paddingTop: 8 }}>
            <TotalRow label="Итого" value={`${formatMoney(order.total_amount)} ₸`} bold />
            <TotalRow label="Оплачено" value={`${formatMoney(totalPaid)} ₸`} />
            {order.debt_amount > 0.01 && (
              <TotalRow label="Остаток к оплате" value={`${formatMoney(order.debt_amount)} ₸`} color="#c00" />
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div style={{ marginTop: 14, padding: "8px 10px", background: "#f7f7f7", borderRadius: 4 }}>
              <div style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const, color: "#888", marginBottom: 3 }}>Примечание</div>
              <div style={{ whiteSpace: "pre-wrap" as const }}>{order.notes}</div>
            </div>
          )}

          {/* Signature */}
          <div style={{ marginTop: 36, paddingTop: 6, borderTop: "1px solid #333", width: 200, fontSize: 10, color: "#aaa" }}>
            Подпись оператора
          </div>

          <div style={{ marginTop: 16, fontSize: 10, color: "#aaa", textAlign: "center" as const }}>
            {companyName} &middot; {formatDate(order.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small components with inline styles ─────────────────────────────

function InfoRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr>
      <td style={{ color: "#888", paddingRight: 16, paddingBottom: 2, verticalAlign: "top", whiteSpace: "nowrap" as const }}>{label}</td>
      <td style={{ paddingBottom: 2, fontWeight: bold ? 600 : 400 }}>{value}</td>
    </tr>
  );
}

function TotalRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontSize: 14, fontWeight: bold ? 700 : 400, color: color ?? "#222" }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function ItemCard({ item }: { item: OrderItem }) {
  const specs = getItemSpecs(item);

  return (
    <div style={{ marginBottom: 10, padding: "8px 10px", border: "1px solid #e0e0e0", borderRadius: 5 }}>
      {/* Row: description + price */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <span style={{ fontWeight: 600 }}>{item.description || ITEM_KIND_LABELS[item.item_kind]}</span>
          <span style={{ color: "#888", marginLeft: 6 }}>&times;&nbsp;{item.qty}&nbsp;шт.</span>
        </div>
        <div style={{ fontWeight: 600, whiteSpace: "nowrap" as const }}>{formatMoney(item.total_price)} ₸</div>
      </div>

      {/* Spec details */}
      {specs.length > 0 && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#666", lineHeight: 1.6 }}>
          {specs.map((s, i) => (
            <span key={i}>
              {i > 0 && <span style={{ color: "#ccc", margin: "0 6px" }}>&middot;</span>}
              {s.label}: {s.value}
            </span>
          ))}
        </div>
      )}
      {item.note && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#555", fontStyle: "italic" }}>
          {item.note}
        </div>
      )}
    </div>
  );
}

// ── Spec extraction ─────────────────────────────────────────────────

interface SpecEntry { label: string; value: string }

function getItemSpecs(item: OrderItem): SpecEntry[] {
  try {
    const spec = JSON.parse(item.spec_snapshot_json);
    const result: SpecEntry[] = [];

    if (item.item_kind === "book") {
      push(result, "Формат", spec.format);
      push(result, "Разворотов", spec.spread_count);
      push(result, "Материал блока", spec.block_material);
      push(result, "Ламинация", spec.lamination);
      if (Array.isArray(spec.cover_options) && spec.cover_options.length > 0) {
        result.push({ label: "Опции обложки", value: spec.cover_options.join(", ") });
      }
    } else if (item.item_kind === "print") {
      push(result, "Формат", spec.print_format ?? spec.format);
      push(result, "Материал", spec.material ?? spec.wide_format_material);
      push(result, "Ламинация", spec.lamination ?? spec.lamination_type);
      push(result, "Отделка", spec.finishing);
    }

    return result;
  } catch {
    return [];
  }
}

function push(arr: SpecEntry[], label: string, value: unknown) {
  if (value != null && value !== "") arr.push({ label, value: String(value) });
}

// ── Item production sheet (наряд) ───────────────────────────────────

interface ItemPrintProps {
  order: Order;
  item: OrderItem;
  onClose: () => void;
}

export function ItemPrintView({ order, item, onClose }: ItemPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [companyName, setCompanyName] = useState("Фотостудия");

  useEffect(() => {
    system.getSettings().then((s) => setCompanyName(s.company_name));
  }, []);

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;

    const html =
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Наряд ${order.number}</title>` +
      `<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;padding:12mm 15mm;color:#222;line-height:1.5}@media print{body{padding:10mm}}</style>` +
      `</head><body>${el.innerHTML}</body></html>`;

    let iframe = document.getElementById("print-frame") as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "print-frame";
      iframe.style.position = "fixed";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.left = "-9999px";
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      iframe!.contentWindow?.print();
    }, 200);
  };

  const specs = getItemDetailSpecs(item);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-10 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 mb-10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">Наряд</h2>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">
              Печать
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
          </div>
        </div>

        <div style={{ padding: "24px", fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 13, color: "#222", lineHeight: 1.5 }} ref={printRef}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{companyName}</div>
              <div style={{ color: "#888", fontSize: 11 }}>Производственный наряд</div>
            </div>
            <div style={{ textAlign: "right" as const, fontSize: 12 }}>
              <div style={{ fontWeight: 600 }}>№ {order.number}</div>
              <div style={{ color: "#888" }}>{formatDate(order.created_at)}</div>
            </div>
          </div>

          {/* Client */}
          {order.client_name && (
            <div style={{ marginBottom: 12, fontSize: 14 }}>
              <span style={{ color: "#888" }}>Клиент: </span>
              <span style={{ fontWeight: 600 }}>{order.client_name}</span>
            </div>
          )}

          {/* Due date */}
          {order.due_date && (
            <div style={{ marginBottom: 12, fontSize: 14 }}>
              <span style={{ color: "#888" }}>Готовность: </span>
              <span style={{ fontWeight: 600 }}>{formatDate(order.due_date)}</span>
            </div>
          )}

          <div style={{ borderTop: "1px solid #ddd", margin: "12px 0" }} />

          {/* Item description */}
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
            {item.description || ITEM_KIND_LABELS[item.item_kind]}
          </div>

          {/* Specs as rows */}
          <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 12 }}>
            <tbody>
              {specs.map((s, i) => (
                <tr key={i}>
                  <td style={{ color: "#888", paddingRight: 16, paddingBottom: 4, verticalAlign: "top", whiteSpace: "nowrap" as const, fontSize: 13 }}>{s.label}</td>
                  <td style={{ paddingBottom: 4, fontWeight: 500, fontSize: 13 }}>{s.value}</td>
                </tr>
              ))}
              <tr>
                <td style={{ color: "#888", paddingRight: 16, paddingBottom: 4, verticalAlign: "top", whiteSpace: "nowrap" as const, fontSize: 13 }}>Количество</td>
                <td style={{ paddingBottom: 4, fontWeight: 600, fontSize: 14 }}>{item.qty} шт.</td>
              </tr>
              <tr>
                <td style={{ color: "#888", paddingRight: 16, paddingBottom: 4, verticalAlign: "top", whiteSpace: "nowrap" as const, fontSize: 13 }}>Сумма</td>
                <td style={{ paddingBottom: 4, fontWeight: 600, fontSize: 14 }}>{formatMoney(item.total_price)} ₸</td>
              </tr>
            </tbody>
          </table>

          {/* Note */}
          {item.note && (
            <div style={{ padding: "8px 10px", background: "#f7f7f7", borderRadius: 4, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const, color: "#888", marginBottom: 3 }}>Комментарий</div>
              <div style={{ whiteSpace: "pre-wrap" as const }}>{item.note}</div>
            </div>
          )}

          {/* Order notes */}
          {order.notes && (
            <div style={{ padding: "8px 10px", background: "#fffbeb", borderRadius: 4, marginBottom: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 11, textTransform: "uppercase" as const, color: "#888", marginBottom: 3 }}>Примечание к заказу</div>
              <div style={{ whiteSpace: "pre-wrap" as const, fontSize: 12 }}>{order.notes}</div>
            </div>
          )}

          {/* Checkbox area for production */}
          <div style={{ borderTop: "1px solid #ddd", paddingTop: 12, marginTop: 8 }}>
            <div style={{ display: "flex", gap: 24, fontSize: 12, color: "#888" }}>
              <span>☐ Готово</span>
              <span>☐ Проверено</span>
            </div>
          </div>

          <div style={{ marginTop: 24, paddingTop: 6, borderTop: "1px solid #333", width: 200, fontSize: 10, color: "#aaa" }}>
            Подпись сборщика
          </div>

          <div style={{ marginTop: 12, fontSize: 10, color: "#aaa", textAlign: "center" as const }}>
            {companyName} &middot; {formatDate(order.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Detailed specs for production sheet — one row per field */
function getItemDetailSpecs(item: OrderItem): SpecEntry[] {
  try {
    const spec = JSON.parse(item.spec_snapshot_json);
    const result: SpecEntry[] = [];

    if (item.item_kind === "book") {
      push(result, "Формат", spec.format);
      push(result, "Разворотов", spec.spread_count);
      push(result, "Сборка", spec.assembly_kind === "plastic" ? "Пластик" : spec.assembly_kind === "pvc_board" ? "Картон PVC" : spec.assembly_kind);
      push(result, "Обложка", spec.cover_family === "plain" ? "Обычная" : spec.cover_family === "laminated" ? "С ламинацией" : spec.cover_family === "laminated_hard" ? "С ламинацией твёрдая" : spec.cover_family === "eco_leather" ? "Экокожа" : spec.cover_family);
      push(result, "Материал блока", spec.block_material);
      push(result, "Ламинация", spec.lamination);
      if (Array.isArray(spec.cover_options) && spec.cover_options.length > 0) {
        result.push({ label: "Доп. опции", value: spec.cover_options.join(", ") });
      }
    } else if (item.item_kind === "print") {
      push(result, "Формат", spec.print_format ?? spec.format);
      push(result, "Материал", spec.material ?? spec.wide_format_material);
      push(result, "Ламинация", spec.lamination ?? spec.lamination_type);
      push(result, "Отделка", spec.finishing);
    } else if (item.item_kind === "service") {
      push(result, "Услуга", spec.service_name);
    } else if (item.item_kind === "extra") {
      push(result, "Опция", spec.extra_name);
    }

    return result;
  } catch {
    return [];
  }
}

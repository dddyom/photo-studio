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
  type: "receipt" | "production";
  onClose: () => void;
}

export function OrderPrintView({
  order,
  items,
  payments,
  type,
  onClose,
}: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [companyName, setCompanyName] = useState("Фотостудия");

  useEffect(() => {
    system.getSettings().then((s) => setCompanyName(s.company_name));
  }, []);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>${type === "receipt" ? "Квитанция" : "Наряд"} ${order.number}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; padding: 15mm; color: #222; line-height: 1.4; }
            table { width: 100%; border-collapse: collapse; }
            .info-table td { padding: 2px 8px 2px 0; vertical-align: top; }
            .info-table .label { color: #666; width: 130px; }
            .items-table { margin: 10px 0; }
            .items-table th, .items-table td { border: 1px solid #ccc; padding: 5px 8px; }
            .items-table th { background: #f0f0f0; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .total-row td { font-weight: 700; border-top: 2px solid #333; background: #fafafa; }
            .header { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
            .subheader { color: #666; font-size: 12px; margin-bottom: 12px; }
            .divider { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
            .signature-line { margin-top: 30px; padding-top: 8px; border-top: 1px solid #333; width: 200px; font-size: 10px; color: #999; }
            .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
            .spec-table { margin: 4px 0 4px 16px; }
            .spec-table td { padding: 1px 8px 1px 0; font-size: 11px; }
            .spec-table .label { color: #666; width: 140px; }
            .item-block { margin-bottom: 12px; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; }
            .item-header { font-weight: 600; font-size: 13px; margin-bottom: 4px; }
            .item-qty { color: #666; font-weight: normal; font-size: 12px; }
            .notes-block { margin-top: 12px; padding: 8px; background: #f9f9f9; border-radius: 4px; }
            .notes-label { font-weight: 600; font-size: 11px; text-transform: uppercase; color: #666; margin-bottom: 4px; }
            .summary { margin-top: 10px; font-size: 13px; }
            .summary .row { display: flex; justify-content: space-between; padding: 2px 0; }
            .summary .total { font-weight: 700; font-size: 14px; border-top: 1px solid #333; padding-top: 4px; margin-top: 4px; }
            @media print {
              body { padding: 10mm; }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 200);
  };

  const activeItems = items.filter((i) => !i.is_cancelled);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-10 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 mb-10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">
            {type === "receipt" ? "Квитанция" : "Производственный наряд"}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            >
              Печать
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
              &times;
            </button>
          </div>
        </div>

        <div className="p-6" ref={printRef}>
          {type === "receipt" ? (
            <ReceiptContent
              order={order}
              items={activeItems}
              payments={payments}
              companyName={companyName}
            />
          ) : (
            <ProductionContent
              order={order}
              items={activeItems}
              companyName={companyName}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ReceiptContent({
  order,
  items,
  payments,
  companyName,
}: {
  order: Order;
  items: OrderItem[];
  payments: OrderPayment[];
  companyName: string;
}) {
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="header">{companyName}</div>
      <div className="subheader">Квитанция к заказу</div>

      <table className="info-table" style={{ marginBottom: 12 }}>
        <tbody>
          <tr>
            <td className="label">Заказ №</td>
            <td style={{ fontWeight: 600 }}>{order.number}</td>
          </tr>
          <tr>
            <td className="label">Дата</td>
            <td>{formatDate(order.created_at)}</td>
          </tr>
          <tr>
            <td className="label">Клиент</td>
            <td>{order.client_name}</td>
          </tr>
          {order.due_date && (
            <tr>
              <td className="label">Дата готовности</td>
              <td>{formatDate(order.due_date)}</td>
            </tr>
          )}
        </tbody>
      </table>

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Позиция</th>
            <th className="text-center" style={{ width: 50 }}>Кол-во</th>
            <th className="text-right" style={{ width: 80 }}>Цена</th>
            <th className="text-right" style={{ width: 90 }}>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <span style={{ fontSize: 10, color: "#999", marginRight: 4 }}>
                  [{ITEM_KIND_LABELS[item.item_kind]}]
                </span>
                {item.description || ITEM_KIND_LABELS[item.item_kind]}
              </td>
              <td className="text-center">{item.qty}</td>
              <td className="text-right">{formatMoney(item.unit_price)}</td>
              <td className="text-right">{formatMoney(item.total_price)}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={3}>Итого</td>
            <td className="text-right">{formatMoney(order.total_amount)} ₸</td>
          </tr>
        </tbody>
      </table>

      <div className="summary">
        <div className="row">
          <span>Оплачено:</span>
          <span style={{ fontWeight: 600 }}>{formatMoney(totalPaid)} ₸</span>
        </div>
        {order.debt_amount > 0.01 && (
          <div className="row" style={{ color: "#c00" }}>
            <span>Остаток к оплате:</span>
            <span style={{ fontWeight: 600 }}>{formatMoney(order.debt_amount)} ₸</span>
          </div>
        )}
      </div>

      {order.notes && (
        <div className="notes-block">
          <div className="notes-label">Примечание</div>
          <div>{order.notes}</div>
        </div>
      )}

      <div className="signature-line">Подпись оператора</div>
      <div className="footer">
        {companyName} &middot; {formatDate(order.created_at)}
      </div>
    </div>
  );
}

function ProductionContent({
  order,
  items,
  companyName,
}: {
  order: Order;
  items: OrderItem[];
  companyName: string;
}) {
  return (
    <div>
      <div className="header">{companyName} &mdash; Производственный наряд</div>
      <div className="subheader">
        Заказ <strong>{order.number}</strong>
        {" "}&middot; {formatDate(order.created_at)}
        {" "}&middot; {order.client_name}
        {order.due_date && (
          <span> &middot; Готовность: <strong>{formatDate(order.due_date)}</strong></span>
        )}
      </div>

      <hr className="divider" />

      {items.map((item, idx) => (
        <div key={item.id} className="item-block">
          <div className="item-header">
            {idx + 1}. {ITEM_KIND_LABELS[item.item_kind]}: {item.description}
            <span className="item-qty">
              {" "}&times; {item.qty} шт.
            </span>
          </div>
          <SpecDetails item={item} />
        </div>
      ))}

      {items.length === 0 && (
        <div style={{ color: "#999", padding: 20, textAlign: "center" }}>
          Нет позиций
        </div>
      )}

      {order.notes && (
        <div className="notes-block">
          <div className="notes-label">Примечания к заказу</div>
          <div>{order.notes}</div>
        </div>
      )}

      <div className="footer" style={{ marginTop: 30 }}>
        {companyName} &middot; Наряд сформирован {formatDate(new Date().toISOString())}
      </div>
    </div>
  );
}

function SpecDetails({ item }: { item: OrderItem }) {
  try {
    const spec = JSON.parse(item.spec_snapshot_json);
    const entries = Object.entries(spec).filter(
      ([, v]) => v != null && v !== ""
    );
    if (entries.length === 0) return null;
    return (
      <table className="spec-table">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td className="label">{specKeyLabel(key)}</td>
              <td>{String(value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  } catch {
    return null;
  }
}

function specKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    format: "Формат",
    spread_count: "Разворотов",
    block_material: "Материал блока",
    cover_type: "Тип обложки",
    cover_material: "Материал обложки",
    lamination: "Ламинация",
    material: "Материал",
    finishing: "Отделка",
    service_name: "Услуга",
    extra_name: "Опция",
  };
  return labels[key] ?? key;
}

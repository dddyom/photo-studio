import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  orders,
  system,
  type Order,
  type OrderListFilter,
} from "@/infrastructure/tauri-bridge";
import {
  PRODUCTION_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  productionStatusColor,
  paymentStatusColor,
  deliveryStatusColor,
  formatMoney,
  formatDate,
} from "@/shared/orderLabels";

type QuickFilter =
  | "all"
  | "in_work"
  | "ready"
  | "unpaid"
  | "delivered_unpaid";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "in_work", label: "В работе" },
  { key: "ready", label: "Готовые" },
  { key: "unpaid", label: "Неоплаченные" },
  { key: "delivered_unpaid", label: "Выданы, не оплачены" },
];

function quickFilterToApi(qf: QuickFilter): OrderListFilter {
  switch (qf) {
    case "in_work":
      return { production_status: "in_work" };
    case "ready":
      return { production_status: "ready" };
    case "unpaid":
      return { unpaid_only: true };
    case "delivered_unpaid":
      return { delivered_but_unpaid: true };
    default:
      return {};
  }
}

function StatusBadge({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${color}`}
    >
      {label}
    </span>
  );
}

export function OrdersListPage() {
  const navigate = useNavigate();
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [search, setSearch] = useState("");

  const filter = quickFilterToApi(quickFilter);
  const fetchOrders = useCallback(() => orders.list(filter), [quickFilter]);
  const { data, loading } = useTauriCommand(fetchOrders, [
    quickFilter,
  ]);

  const filtered = (data ?? []).filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      o.number.toLowerCase().includes(q) ||
      (o.client_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Заказы</h1>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
            onClick={async () => {
              try {
                const path = await system.exportOrdersCsv();
                toast.success(`Экспорт сохранён:\n${path}`, { duration: 5000 });
              } catch (err) {
                toast.error(String(err));
              }
            }}
          >
            Экспорт CSV
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
            onClick={() => navigate("/orders/new")}
          >
            + Новый заказ
          </button>
        </div>
      </div>

      {/* Quick filters */}
      <div className="flex items-center gap-2 mb-4">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setQuickFilter(f.key)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              quickFilter === f.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по номеру / клиенту..."
            className="px-3 py-1.5 border border-gray-200 rounded-md text-sm w-64 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
          />
        </div>
      </div>

      {/* Orders table */}
      <div className="bg-white border border-gray-200 rounded-md">
        {loading ? (
          <p className="text-gray-500 p-5">Загрузка...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            {data && data.length > 0
              ? "Ничего не найдено"
              : "Нет заказов"}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {["Номер", "Клиент", "Статус", "Оплата", "Выдача", "Сумма", "Долг", "Дата"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    onClick={() => navigate(`/orders/${o.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRow({
  order: o,
  onClick,
}: {
  order: Order;
  onClick: () => void;
}) {
  return (
    <tr
      className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 transition-colors"
      onClick={onClick}
    >
      <td className="px-3 py-2.5 font-mono text-sm font-medium">
        {o.number}
      </td>
      <td className="px-3 py-2.5">{o.client_name ?? "—"}</td>
      <td className="px-3 py-2.5">
        <StatusBadge
          label={PRODUCTION_STATUS_LABELS[o.production_status]}
          color={productionStatusColor(o.production_status)}
        />
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge
          label={PAYMENT_STATUS_LABELS[o.payment_status]}
          color={paymentStatusColor(o.payment_status)}
        />
      </td>
      <td className="px-3 py-2.5">
        <StatusBadge
          label={DELIVERY_STATUS_LABELS[o.delivery_status]}
          color={deliveryStatusColor(o.delivery_status)}
        />
      </td>
      <td className="px-3 py-2.5 text-right font-mono">
        {formatMoney(o.total_amount)}
      </td>
      <td className="px-3 py-2.5 text-right font-mono">
        {o.debt_amount > 0 ? (
          <span className="text-red-600">{formatMoney(o.debt_amount)}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5 text-gray-500 text-sm">
        {formatDate(o.created_at)}
      </td>
    </tr>
  );
}

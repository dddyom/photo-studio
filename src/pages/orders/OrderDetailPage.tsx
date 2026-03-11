import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  orders,
  orderItems,
  orderPayments,
  type Order,
  type OrderItem,
} from "@/infrastructure/tauri-bridge";
import {
  PRODUCTION_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  ITEM_KIND_LABELS,
  productionStatusColor,
  paymentStatusColor,
  deliveryStatusColor,
  formatMoney,
  formatDate,
  formatDateTime,
} from "@/shared/orderLabels";
import { AddItemPanel } from "./components/AddItemPanel";
import { PaymentModal } from "./components/PaymentModal";
import { DeliveryModal } from "./components/DeliveryModal";
import { OrderPrintView } from "./components/OrderPrintView";

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${color}`}>
      {label}
    </span>
  );
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderId = Number(id);

  const fetchOrder = useCallback(() => orders.get(orderId), [orderId]);
  const fetchItems = useCallback(() => orderItems.list(orderId), [orderId]);
  const fetchPayments = useCallback(
    () => orderPayments.list(orderId),
    [orderId]
  );
  const fetchDeliveries = useCallback(
    () => orderPayments.listDeliveries(orderId),
    [orderId]
  );

  const {
    data: order,
    loading,
    refetch: refetchOrder,
  } = useTauriCommand(fetchOrder, [orderId]);
  const { data: items, refetch: refetchItems } = useTauriCommand(fetchItems, [
    orderId,
  ]);
  const { data: payments, refetch: refetchPayments } = useTauriCommand(
    fetchPayments,
    [orderId]
  );
  const { data: deliveries, refetch: refetchDeliveries } = useTauriCommand(
    fetchDeliveries,
    [orderId]
  );

  const [showAddItem, setShowAddItem] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const [showPrint, setShowPrint] = useState<"receipt" | "production" | null>(
    null
  );

  const refetchAll = () => {
    refetchOrder();
    refetchItems();
    refetchPayments();
    refetchDeliveries();
  };

  if (loading || !order) {
    return <p className="text-gray-500">Загрузка...</p>;
  }

  const isDraft = order.production_status === "draft";
  const isCancelled = order.production_status === "cancelled";
  const activeItems = (items ?? []).filter((i) => !i.is_cancelled);

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate("/orders")}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              &larr; Заказы
            </button>
          </div>
          <h1 className="text-2xl font-semibold">
            Заказ {order.number}
          </h1>
          <p className="text-gray-500 mt-0.5">
            {order.client_name} &middot; {formatDate(order.created_at)}
            {order.due_date && (
              <span> &middot; Готовность: {formatDate(order.due_date)}</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {!isCancelled && (
            <button
              onClick={() => setShowPrint("receipt")}
              className="px-3 py-1.5 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Квитанция
            </button>
          )}
          {!isCancelled && !isDraft && (
            <button
              onClick={() => setShowPrint("production")}
              className="px-3 py-1.5 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Наряд
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 mb-5">
        <StatusBadge
          label={PRODUCTION_STATUS_LABELS[order.production_status]}
          color={productionStatusColor(order.production_status)}
        />
        <StatusBadge
          label={PAYMENT_STATUS_LABELS[order.payment_status]}
          color={paymentStatusColor(order.payment_status)}
        />
        <StatusBadge
          label={DELIVERY_STATUS_LABELS[order.delivery_status]}
          color={deliveryStatusColor(order.delivery_status)}
        />
      </div>

      {/* Action buttons */}
      {!isCancelled && (
        <ActionBar
          order={order}
          onRefresh={refetchAll}
          onAddItem={() => setShowAddItem(true)}
          onPayment={() => setShowPayment(true)}
          onDelivery={() => setShowDelivery(true)}
        />
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* Left: items */}
        <div className="lg:col-span-2 space-y-4">
          {/* Items */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Позиции</h2>
              {isDraft && (
                <button
                  onClick={() => setShowAddItem(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Добавить
                </button>
              )}
            </div>
            {activeItems.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">
                Нет позиций
              </p>
            ) : (
              <div className="space-y-2">
                {(items ?? []).map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isDraft={isDraft}
                    onCancel={async () => {
                      if (!confirm(`Удалить позицию "${item.description || ITEM_KIND_LABELS[item.item_kind]}"?`)) return;
                      try {
                        await orderItems.cancel(item.id);
                        toast.success("Позиция удалена");
                        refetchAll();
                      } catch (err) {
                        toast.error(String(err));
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <h2 className="text-base font-semibold mb-2">Заметки</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {order.notes}
              </p>
            </div>
          )}
        </div>

        {/* Right: summary + payments + deliveries */}
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <h2 className="text-base font-semibold mb-3">Итого</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Сумма заказа</span>
                <span className="font-mono font-medium">
                  {formatMoney(order.total_amount)} ₸
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Оплачено</span>
                <span className="font-mono">
                  {formatMoney(order.paid_amount)} ₸
                </span>
              </div>
              {order.debt_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Остаток</span>
                  <span className="font-mono text-red-600 font-medium">
                    {formatMoney(order.debt_amount)} ₸
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Payments */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Оплаты</h2>
              {!isCancelled && (
                <button
                  onClick={() => setShowPayment(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Оплата
                </button>
              )}
            </div>
            {!payments || payments.length === 0 ? (
              <p className="text-gray-400 text-sm">Нет оплат</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between py-1 border-b border-gray-50 last:border-0"
                  >
                    <span className="text-gray-600">
                      {formatDateTime(p.paid_at)}
                    </span>
                    <span className="font-mono">
                      +{formatMoney(p.amount)} ₸
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deliveries */}
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold">Выдача</h2>
              {!isCancelled && !isDraft && (
                <button
                  onClick={() => setShowDelivery(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Выдать
                </button>
              )}
            </div>
            {!deliveries || deliveries.length === 0 ? (
              <p className="text-gray-400 text-sm">Не выдан</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {deliveries.map((d) => (
                  <div key={d.id} className="py-1 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600">
                      {formatDateTime(d.delivered_at)}
                    </span>
                    {d.delivered_by && (
                      <span className="text-gray-500 ml-2">
                        ({d.delivered_by})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddItem && (
        <AddItemPanel
          orderId={orderId}
          onClose={() => setShowAddItem(false)}
          onAdded={refetchAll}
        />
      )}
      {showPayment && (
        <PaymentModal
          order={order}
          onClose={() => setShowPayment(false)}
          onDone={refetchAll}
        />
      )}
      {showDelivery && (
        <DeliveryModal
          order={order}
          onClose={() => setShowDelivery(false)}
          onDone={refetchAll}
        />
      )}
      {showPrint && (
        <OrderPrintView
          order={order}
          items={items ?? []}
          payments={payments ?? []}
          type={showPrint}
          onClose={() => setShowPrint(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────

function ActionBar({
  order,
  onRefresh,
  onAddItem,
  onPayment,
  onDelivery,
}: {
  order: Order;
  onRefresh: () => void;
  onAddItem: () => void;
  onPayment: () => void;
  onDelivery: () => void;
}) {
  const nextStatus = getNextProductionStatus(order.production_status);

  const changeStatus = async (status: string) => {
    try {
      if (status === "cancelled") {
        if (!confirm("Отменить заказ?")) return;
        await orders.cancel(order.id);
      } else if (status === "confirmed") {
        await orders.confirm(order.id);
      } else {
        await orders.updateProductionStatus(order.id, status);
      }
      toast.success(`Статус: ${PRODUCTION_STATUS_LABELS[status as keyof typeof PRODUCTION_STATUS_LABELS] ?? status}`);
      onRefresh();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {order.production_status === "draft" && (
        <button
          onClick={onAddItem}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          + Позиция
        </button>
      )}
      {nextStatus && (
        <button
          onClick={() => changeStatus(nextStatus)}
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
        >
          {PRODUCTION_STATUS_LABELS[nextStatus as keyof typeof PRODUCTION_STATUS_LABELS] ??
            nextStatus}
        </button>
      )}
      <button
        onClick={onPayment}
        className="px-3 py-1.5 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
      >
        Оплата
      </button>
      {!["draft", "cancelled"].includes(order.production_status) && (
        <button
          onClick={onDelivery}
          className="px-3 py-1.5 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
        >
          Выдать
        </button>
      )}
      {["draft", "confirmed", "in_work"].includes(
        order.production_status
      ) && (
        <button
          onClick={() => changeStatus("cancelled")}
          className="px-3 py-1.5 text-red-600 border border-red-200 bg-white text-sm rounded-md hover:bg-red-50 transition-colors"
        >
          Отменить
        </button>
      )}
    </div>
  );
}

function getNextProductionStatus(
  current: string
): string | null {
  switch (current) {
    case "draft":
      return "confirmed";
    case "confirmed":
      return "in_work";
    case "in_work":
      return "ready";
    case "ready":
      return "closed";
    default:
      return null;
  }
}

function ItemRow({
  item,
  isDraft,
  onCancel,
}: {
  item: OrderItem;
  isDraft: boolean;
  onCancel: () => void;
}) {
  return (
    <div
      className={`flex items-start justify-between py-2 px-3 rounded border ${
        item.is_cancelled
          ? "border-gray-100 bg-gray-50 opacity-60 line-through"
          : "border-gray-100"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
            {ITEM_KIND_LABELS[item.item_kind]}
          </span>
          {item.price_source === "manual" && (
            <span className="text-xs px-1.5 py-0.5 bg-yellow-100 rounded text-yellow-700">
              Ручная цена
            </span>
          )}
        </div>
        <p className="text-sm mt-1">{item.description || "—"}</p>
      </div>
      <div className="text-right ml-4 shrink-0">
        <div className="text-sm font-mono">
          {item.qty} x {formatMoney(item.unit_price)} ={" "}
          <span className="font-medium">{formatMoney(item.total_price)} ₸</span>
        </div>
        {!item.is_cancelled && (isDraft || !isDraft) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="text-xs text-red-500 hover:text-red-600 mt-1"
          >
            Удалить
          </button>
        )}
      </div>
    </div>
  );
}

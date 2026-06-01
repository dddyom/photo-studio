import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { orders } from "@/infrastructure/tauri-bridge";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
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

/**
 * Clickable order number in the finance journal. Click opens a lazily-loaded
 * popover with a short order summary (client, statuses, amounts, items) so the
 * operator can see whose money this is without leaving the journal, plus a link
 * into the order itself.
 */
export function OrderSummaryPopover({
  orderId,
  orderNumber,
  voided = false,
}: {
  orderId: number;
  orderNumber: string;
  voided?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 6, left: r.left });
  };

  const toggle = () => {
    if (!open) place();
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        title="Показать сводку по заказу"
        className={`font-mono hover:underline ${
          voided ? "text-gray-400 line-through" : "text-blue-600"
        }`}
      >
        {orderNumber}
      </button>
      {open && pos && (
        <>
          {/* click-away layer */}
          {createPortal(
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />,
            document.body,
          )}
          {createPortal(
            <div
              className="fixed z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm"
              style={{ top: pos.top, left: pos.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <PopoverBody orderId={orderId} orderNumber={orderNumber} onGo={() => setOpen(false)} />
            </div>,
            document.body,
          )}
        </>
      )}
    </>
  );
}

function PopoverBody({
  orderId,
  orderNumber,
  onGo,
}: {
  orderId: number;
  orderNumber: string;
  onGo: () => void;
}) {
  const { data: order, loading } = useTauriCommand(() => orders.get(orderId), [orderId]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono font-semibold">{orderNumber}</span>
        <Link
          to={`/orders/${orderId}`}
          onClick={onGo}
          className="text-xs text-blue-600 hover:text-blue-700"
        >
          Открыть заказ →
        </Link>
      </div>

      {loading || !order ? (
        <div className="text-xs text-gray-400 py-2">Загрузка…</div>
      ) : (
        <div className="space-y-2">
          <div className="text-gray-800 font-medium truncate">
            {order.client_name ?? "Без клиента"}
          </div>

          <div className="flex flex-wrap gap-1">
            <Badge label={PRODUCTION_STATUS_LABELS[order.production_status]} color={productionStatusColor(order.production_status)} />
            <Badge label={PAYMENT_STATUS_LABELS[order.payment_status]} color={paymentStatusColor(order.payment_status)} />
            <Badge label={DELIVERY_STATUS_LABELS[order.delivery_status]} color={deliveryStatusColor(order.delivery_status)} />
          </div>

          <div className="grid grid-cols-3 gap-1 text-xs pt-1">
            <Stat label="Сумма" value={`${formatMoney(order.total_amount)} ₸`} />
            <Stat label="Оплачено" value={`${formatMoney(order.paid_amount)} ₸`} />
            <Stat
              label="Долг"
              value={`${formatMoney(order.debt_amount)} ₸`}
              tone={order.debt_amount > 0.01 ? "red" : undefined}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
            <span>{order.items_count} поз.</span>
            <span>{formatDate(order.created_at)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${color}`}>{label}</span>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "red" }) {
  return (
    <div>
      <div className="text-gray-400">{label}</div>
      <div className={`font-mono ${tone === "red" ? "text-red-600" : "text-gray-700"}`}>{value}</div>
    </div>
  );
}

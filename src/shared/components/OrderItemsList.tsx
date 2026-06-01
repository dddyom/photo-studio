import { orderItems } from "@/infrastructure/tauri-bridge";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import { ITEM_KIND_LABELS, formatMoney } from "@/shared/orderLabels";

/**
 * Lazily-loaded list of an order's items. Mount this only when the row is
 * expanded — it fetches `list_order_items` on mount, so the orders/client
 * lists stay cheap until the user actually opens a row.
 */
export function OrderItemsList({ orderId }: { orderId: number }) {
  const { data, loading } = useTauriCommand(() => orderItems.list(orderId), [orderId]);

  if (loading) {
    return <div className="text-xs text-gray-400 py-1.5">Загрузка позиций…</div>;
  }

  const items = (data ?? []).filter((i) => !i.is_cancelled);
  if (items.length === 0) {
    return <div className="text-xs text-gray-400 py-1.5">Позиций нет</div>;
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((i) => (
        <div key={i.id} className="flex items-baseline gap-2 text-xs">
          <span className="flex-1 text-gray-700 truncate">
            {i.description?.trim() || ITEM_KIND_LABELS[i.item_kind] || i.item_kind}
          </span>
          <span className="text-gray-400 font-mono shrink-0">×{i.qty}</span>
          <span className="text-gray-600 font-mono shrink-0 w-20 text-right">
            {formatMoney(i.total_price)} ₸
          </span>
        </div>
      ))}
    </div>
  );
}

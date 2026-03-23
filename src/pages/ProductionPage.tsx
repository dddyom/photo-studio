import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  production,
  orders,
  orderItems,
  system,
  type ProductionQueueItem,
  type Order,
  type OrderItem,
} from "@/infrastructure/tauri-bridge";
import {
  ITEM_KIND_LABELS,
  nextStepLabel,
  formatDate,
} from "@/shared/orderLabels";
import { ItemPrintView } from "./orders/components/OrderPrintView";

type QueueTab = "print" | "assembly";

export function ProductionPage() {
  const [tab, setTab] = useState<QueueTab>("print");
  const [printData, setPrintData] = useState<{ order: Order; item: OrderItem } | null>(null);
  const navigate = useNavigate();

  const fetchQueue = useCallback(() => production.listQueue(tab), [tab]);
  const { data: items, refetch } = useTauriCommand(fetchQueue, [tab]);

  const handleAdvance = async (item: ProductionQueueItem) => {
    try {
      await production.advanceStep(item.order_item_id);
      refetch();
    } catch (err) { toast.error(String(err)); }
  };

  const handlePrint = async (item: ProductionQueueItem) => {
    try {
      const [order, allItems] = await Promise.all([
        orders.get(item.order_id),
        orderItems.list(item.order_id),
      ]);
      const orderItem = allItems.find((i) => i.id === item.order_item_id);
      if (!orderItem) { toast.error("Позиция не найдена"); return; }
      setPrintData({ order, item: orderItem });
    } catch (err) { toast.error(String(err)); }
  };

  const count = items?.length ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <h1 className="text-2xl font-semibold">Производство</h1>
        <div className="flex gap-1">
          {(["print", "assembly"] as QueueTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                tab === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === "print" ? "Печать" : "Сборка"}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-400 ml-auto">{count} поз.</span>
      </div>

      {count === 0 ? (
        <div className="flex items-center justify-center py-24 text-gray-400 text-lg">
          {tab === "print" ? "Нет позиций для печати" : "Нет позиций для сборки"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items!.map((item) => {
            const next = nextStepLabel(item.item_kind, item.production_step);
            return (
              <div key={item.order_item_id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={() => navigate(`/orders/${item.order_id}`)}
                      className="font-mono text-base text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      {item.order_number}
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePrint(item)}
                        className="text-xs px-2 py-0.5 border border-gray-300 rounded text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                      >
                        Наряд
                      </button>
                      <span className="text-xs text-gray-400">{formatDate(item.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-1">{item.client_name}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                      {ITEM_KIND_LABELS[item.item_kind]}
                    </span>
                    <span className="text-xs text-gray-500">x{item.qty}</span>
                  </div>
                  <p className="text-sm text-gray-800">{item.description || "—"}</p>
                  {item.folder_path && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try { await system.openFolder(item.folder_path!); }
                        catch (err) { toast.error(String(err)); }
                      }}
                      className="mt-1.5 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 text-left break-all"
                    >
                      📂 {item.folder_path}
                    </button>
                  )}
                </div>
                {next && (
                  <div className="mt-4">
                    <button
                      onClick={() => handleAdvance(item)}
                      className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
                    >
                      {next}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {printData && (
        <ItemPrintView order={printData.order} item={printData.item} onClose={() => setPrintData(null)} />
      )}
    </div>
  );
}

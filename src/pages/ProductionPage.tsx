import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  production,
  type ProductionQueueItem,
} from "@/infrastructure/tauri-bridge";
import {
  ITEM_KIND_LABELS,
  PRODUCTION_STEP_LABELS,
  nextStepLabel,
  formatDate,
} from "@/shared/orderLabels";

type QueueTab = "print" | "assembly";

export function ProductionPage() {
  const [tab, setTab] = useState<QueueTab>("print");

  const fetchQueue = useCallback(() => production.listQueue(tab), [tab]);
  const { data: items, refetch } = useTauriCommand(fetchQueue, [tab]);

  const navigate = useNavigate();

  const handleAdvance = async (item: ProductionQueueItem) => {
    try {
      await production.advanceStep(item.order_item_id);
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Производство</h1>
        <p className="text-gray-500 text-sm mt-1">
          Очередь работ по позициям заказов
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab("print")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === "print"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Печать
        </button>
        <button
          onClick={() => setTab("assembly")}
          className={`px-4 py-2 text-sm rounded-md transition-colors ${
            tab === "assembly"
              ? "bg-blue-600 text-white"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          Сборка
        </button>
      </div>

      {/* Queue */}
      <div className="bg-white border border-gray-200 rounded-md">
        {!items || items.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {tab === "print"
              ? "Нет позиций для печати"
              : "Нет позиций для сборки"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                <th className="text-left font-medium px-4 py-2">Заказ</th>
                <th className="text-left font-medium px-4 py-2">Клиент</th>
                <th className="text-left font-medium px-4 py-2">Позиция</th>
                <th className="text-center font-medium px-4 py-2">Кол-во</th>
                <th className="text-left font-medium px-4 py-2">Этап</th>
                <th className="text-left font-medium px-4 py-2">Создан</th>
                <th className="w-28 px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((item) => {
                const next = nextStepLabel(item.item_kind, item.production_step);
                return (
                  <tr key={item.order_item_id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => navigate(`/orders/${item.order_id}`)}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        {item.order_number}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {item.client_name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-400 mr-1">
                        {ITEM_KIND_LABELS[item.item_kind]}
                      </span>
                      <span className="text-gray-700">
                        {item.description || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-gray-700">
                      {item.qty}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-gray-500">
                        {PRODUCTION_STEP_LABELS[item.production_step]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {next && (
                        <button
                          onClick={() => handleAdvance(item)}
                          className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                        >
                          {next}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

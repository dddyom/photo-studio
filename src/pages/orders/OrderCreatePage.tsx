import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  clients,
  pricing,
  orders,
} from "@/infrastructure/tauri-bridge";

export function OrderCreatePage() {
  const navigate = useNavigate();
  const { data: clientList } = useTauriCommand(clients.list);
  const { data: programs } = useTauriCommand(pricing.listPrograms);

  const [clientId, setClientId] = useState<number | "">("");
  const [pricingProgramId, setPricingProgramId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-fill pricing program from client default
  useEffect(() => {
    if (clientId && clientList) {
      const c = clientList.find((cl) => cl.id === clientId);
      if (c?.default_pricing_program_id) {
        setPricingProgramId(c.default_pricing_program_id);
      }
    }
  }, [clientId, clientList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast.error("Выберите клиента");
      return;
    }
    setSubmitting(true);
    try {
      const order = await orders.create({
        client_id: clientId as number,
        pricing_program_id: pricingProgramId || null,
        notes: notes || null,
        due_date: dueDate || null,
      });
      toast.success(`Заказ ${order.number} создан`);
      navigate(`/orders/${order.id}`);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">Новый заказ</h1>
        <p className="text-gray-500 mt-1">
          После создания вы сможете добавить позиции
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-5 max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Клиент *</label>
            <select
              value={clientId}
              onChange={(e) =>
                setClientId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            >
              <option value="">— Выберите клиента —</option>
              {(clientList ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` (${c.phone})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Программа ценообразования
            </label>
            <select
              value={pricingProgramId}
              onChange={(e) =>
                setPricingProgramId(
                  e.target.value ? Number(e.target.value) : ""
                )
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            >
              <option value="">— Не выбрана —</option>
              {(programs ?? [])
                .filter((p) => p.is_active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">
              Дата готовности
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Заметки</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Комментарий к заказу"
              className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? "Создание..." : "Создать заказ"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/orders")}
              className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useState } from "react";
import toast from "react-hot-toast";
import { orderPayments, type Order } from "@/infrastructure/tauri-bridge";
import { formatMoney } from "@/shared/orderLabels";

const INPUT =
  "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

interface Props {
  order: Order;
  onClose: () => void;
  onDone: () => void;
}

export function DeliveryModal({ order, onClose, onDone }: Props) {
  const [deliveredBy, setDeliveredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    try {
      await orderPayments.registerDelivery({
        order_id: order.id,
        delivered_by: deliveredBy || null,
        notes: notes || null,
      });
      toast.success("Заказ выдан");
      onDone();
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-20">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">Выдача заказа</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            &times;
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-sm">
            Заказ {order.number}
            {order.debt_amount > 0 && (
              <div className="mt-1 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-800 text-sm">
                Остаток к оплате: <strong>{formatMoney(order.debt_amount)} ₸</strong>
                <br />
                <span className="text-xs">Выдача разрешена при любом статусе оплаты</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Кто выдал</label>
            <input value={deliveredBy} onChange={(e) => setDeliveredBy(e.target.value)} placeholder="Имя оператора" className={INPUT} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Заметки</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Дополнительная информация" className={INPUT} />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
              {submitting ? "..." : "Подтвердить выдачу"}
            </button>
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

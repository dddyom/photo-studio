import { useState } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  catalogs,
  clients as clientsApi,
  orderPayments,
  clientBalance,
  type Order,
} from "@/infrastructure/tauri-bridge";
import { formatMoney, PAYMENT_METHOD_LABELS } from "@/shared/orderLabels";

const INPUT =
  "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

const PAYMENT_METHODS = ["cash", "card", "bank_transfer"] as const;

type PaySource = "external" | "balance";

interface Props {
  order: Order;
  onClose: () => void;
  onDone: () => void;
}

export function PaymentModal({ order, onClose, onDone }: Props) {
  const { data: accounts } = useTauriCommand(catalogs.companyAccounts);
  const { data: client } = useTauriCommand(
    () => clientsApi.get(order.client_id),
    [order.client_id]
  );
  const [amount, setAmount] = useState(
    order.debt_amount > 0 ? String(order.debt_amount) : ""
  );
  const [method, setMethod] = useState<string>("cash");
  const [accountId, setAccountId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [paySource, setPaySource] = useState<PaySource>("external");
  const [submitting, setSubmitting] = useState(false);

  const clientBalanceAmount = client?.balance ?? 0;

  // Auto-select first account matching method
  const matchingAccount = (accounts ?? []).find((a) => {
    const name = a.name.toLowerCase();
    if (method === "cash") return name.includes("касс");
    if (method === "card") return name.includes("карт");
    return name.includes("счёт") || name.includes("счет");
  });

  const effectiveAccountId = accountId || matchingAccount?.id;

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Укажите сумму");
      return;
    }
    setSubmitting(true);
    try {
      if (paySource === "balance") {
        await clientBalance.payOrder({
          order_id: order.id,
          amount: amt,
          notes: notes || null,
        });
        toast.success(`Списано с баланса: ${formatMoney(amt)} ₸`);
      } else {
        if (!effectiveAccountId) {
          toast.error("Выберите счёт");
          setSubmitting(false);
          return;
        }
        const result = await orderPayments.register({
          order_id: order.id,
          amount: amt,
          payment_method: method,
          account_id: effectiveAccountId,
          notes: notes || null,
        });
        if (result.surplus_to_balance > 0.01) {
          toast.success(
            `Оплата ${formatMoney(amt)} ₸. На баланс клиента: ${formatMoney(result.surplus_to_balance)} ₸`,
            { duration: 5000 }
          );
        } else {
          toast.success(`Оплата ${formatMoney(amt)} ₸ зарегистрирована`);
        }
      }
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
          <h2 className="text-base font-semibold">Оплата</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            &times;
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-sm text-gray-500 mb-2">
            Заказ {order.number} &middot; Сумма: {formatMoney(order.total_amount)} ₸
            {order.debt_amount > 0 && (
              <span> &middot; Остаток: <span className="text-red-600 font-medium">{formatMoney(order.debt_amount)} ₸</span></span>
            )}
          </div>

          {/* Pay source selector */}
          {clientBalanceAmount > 0.01 && (
            <div>
              <label className="block text-sm font-medium mb-1">Источник</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPaySource("external")}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    paySource === "external"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  Внешняя оплата
                </button>
                <button
                  onClick={() => {
                    setPaySource("balance");
                    // Pre-fill with min(balance, debt)
                    const maxFromBalance = Math.min(clientBalanceAmount, order.debt_amount > 0 ? order.debt_amount : clientBalanceAmount);
                    setAmount(String(maxFromBalance));
                  }}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    paySource === "balance"
                      ? "bg-green-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  С баланса ({formatMoney(clientBalanceAmount)} ₸)
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Сумма *</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={INPUT} />
          </div>

          {paySource === "external" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Способ оплаты</label>
                <div className="flex gap-2">
                  {PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                        method === m
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      {PAYMENT_METHOD_LABELS[m]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Счёт</label>
                <select
                  value={accountId || effectiveAccountId || ""}
                  onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : "")}
                  className={INPUT}
                >
                  <option value="">— Выберите —</option>
                  {(accounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Комментарий</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Предоплата, доплата..." className={INPUT} />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors disabled:opacity-50">
              {submitting ? "..." : paySource === "balance" ? "Списать с баланса" : "Принять оплату"}
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

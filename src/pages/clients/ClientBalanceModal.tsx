import { useState } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  clientBalance,
  catalogs,
  type Client,
} from "@/infrastructure/tauri-bridge";
import { formatMoney, PAYMENT_METHOD_LABELS } from "@/shared/orderLabels";

const BALANCE_TX_TYPE_LABELS: Record<string, string> = {
  deposit: "Пополнение",
  withdraw: "Вывод",
  order_payment: "Оплата заказа",
  order_surplus: "Излишек по заказу",
};

const PAYMENT_METHODS = ["cash", "card", "bank_transfer"] as const;

const INPUT =
  "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

interface Props {
  client: Pick<Client, "id" | "name" | "balance">;
  onClose: () => void;
  onChanged: () => void;
}

export function ClientBalanceModal({ client, onClose, onChanged }: Props) {
  const { data: history, refetch: refetchHistory } = useTauriCommand(
    () => clientBalance.history(client.id),
    [client.id]
  );
  const { data: currentBalance, refetch: refetchBalance } = useTauriCommand(
    () => clientBalance.getBalance(client.id),
    [client.id]
  );
  const { data: accounts } = useTauriCommand(catalogs.companyAccounts);
  const [mode, setMode] = useState<"view" | "deposit" | "withdraw">("view");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [accountId, setAccountId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const matchingAccount = (accounts ?? []).find((a) => {
    const name = a.name.toLowerCase();
    if (method === "cash") return name.includes("касс");
    if (method === "card") return name.includes("карт");
    return name.includes("счёт") || name.includes("счет");
  });
  const effectiveAccountId = accountId || matchingAccount?.id;

  const balance = currentBalance ?? client.balance;

  const submit = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Укажите сумму");
      return;
    }
    if (!effectiveAccountId) {
      toast.error("Выберите счёт");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "deposit") {
        await clientBalance.deposit({
          client_id: client.id,
          amount: amt,
          payment_method: method,
          account_id: effectiveAccountId,
          notes: notes || null,
        });
        toast.success(`Баланс пополнен на ${formatMoney(amt)} ₸`);
      } else {
        await clientBalance.withdraw({
          client_id: client.id,
          amount: amt,
          payment_method: method,
          account_id: effectiveAccountId,
          notes: notes || null,
        });
        toast.success(`Выведено ${formatMoney(amt)} ₸`);
      }
      setAmount("");
      setNotes("");
      setMode("view");
      refetchHistory();
      refetchBalance();
      onChanged();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-16">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold">Баланс: {client.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Текущий баланс:{" "}
              <span className={balance > 0.01 ? "text-green-600 font-medium" : "text-gray-400"}>
                {formatMoney(balance)} ₸
              </span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">
            &times;
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {mode === "view" ? (
            <>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setMode("deposit")}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                >
                  Пополнить
                </button>
                <button
                  onClick={() => setMode("withdraw")}
                  disabled={balance < 0.01}
                  className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-md hover:bg-orange-600 transition-colors disabled:opacity-50"
                >
                  Вывести
                </button>
              </div>

              {!history || history.length === 0 ? (
                <p className="text-gray-400 text-sm py-4 text-center">Нет операций</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left text-xs text-gray-500 pb-2">Дата</th>
                      <th className="text-left text-xs text-gray-500 pb-2">Операция</th>
                      <th className="text-right text-xs text-gray-500 pb-2">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((tx) => (
                      <tr key={tx.id} className="border-t border-gray-100">
                        <td className="py-1.5 text-gray-500">
                          {new Date(tx.created_at).toLocaleDateString("ru")}
                        </td>
                        <td className="py-1.5">
                          {BALANCE_TX_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                          {tx.order_number && (
                            <span className="text-gray-400 ml-1">#{tx.order_number}</span>
                          )}
                        </td>
                        <td className={`py-1.5 text-right font-medium ${
                          tx.direction === "in" ? "text-green-600" : "text-red-500"
                        }`}>
                          {tx.direction === "in" ? "+" : "-"}{formatMoney(tx.amount)} ₸
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <h3 className="font-medium text-sm">
                {mode === "deposit" ? "Пополнение баланса" : "Вывод с баланса"}
              </h3>
              {mode === "withdraw" && (
                <p className="text-xs text-gray-500">
                  Доступно: {formatMoney(balance)} ₸
                </p>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Сумма *</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={INPUT}
                />
              </div>
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
              <div>
                <label className="block text-sm font-medium mb-1">Комментарий</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={INPUT}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={submit}
                  disabled={submitting}
                  className={`px-4 py-2 text-white text-sm rounded-md transition-colors disabled:opacity-50 ${
                    mode === "deposit"
                      ? "bg-green-600 hover:bg-green-700"
                      : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {submitting ? "..." : mode === "deposit" ? "Пополнить" : "Вывести"}
                </button>
                <button
                  onClick={() => setMode("view")}
                  className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
                >
                  Назад
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

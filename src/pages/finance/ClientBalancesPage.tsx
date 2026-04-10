import { useState } from "react";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import { clientBalance, type ClientWithBalance } from "@/infrastructure/tauri-bridge";
import { formatMoney } from "@/shared/orderLabels";
import { FinanceNav } from "./FinanceNav";
import { ClientBalanceModal } from "../clients/ClientBalanceModal";

export function ClientBalancesPage() {
  const { data, loading, refetch } = useTauriCommand(clientBalance.listClientsWithBalance);
  const [selected, setSelected] = useState<ClientWithBalance | null>(null);

  const rows = data ?? [];
  const total = rows.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-semibold">Финансы</h1>
        <p className="text-gray-500 mt-1">Авансы и обязательства перед клиентами</p>
      </div>

      <FinanceNav />

      <div className="bg-white border border-gray-200 rounded-md">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Балансы клиентов</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Деньги, которые клиенты внесли авансом — студия обязана их отработать или вернуть
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Итого обязательств</div>
            <div className="text-xl font-bold font-mono text-purple-600">
              {formatMoney(total)} ₸
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Нет клиентов с положительным балансом</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-2 text-xs font-medium text-gray-500">Клиент</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-gray-500">Телефон</th>
                <th className="text-left px-5 py-2 text-xs font-medium text-gray-500">Последняя операция</th>
                <th className="text-right px-5 py-2 text-xs font-medium text-gray-500">Баланс</th>
                <th className="px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.client_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-5 py-2.5 font-medium">{r.client_name}</td>
                  <td className="px-5 py-2.5 text-gray-500">{r.phone ?? "—"}</td>
                  <td className="px-5 py-2.5 text-gray-500">
                    {r.last_transaction_at
                      ? new Date(r.last_transaction_at).toLocaleDateString("ru")
                      : "—"}
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono font-semibold text-green-600">
                    {formatMoney(r.balance)} ₸
                  </td>
                  <td className="px-5 py-2.5 text-right">
                    <button
                      onClick={() => setSelected(r)}
                      className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <ClientBalanceModal
          client={{ id: selected.client_id, name: selected.client_name, balance: selected.balance }}
          onClose={() => setSelected(null)}
          onChanged={refetch}
        />
      )}
    </div>
  );
}

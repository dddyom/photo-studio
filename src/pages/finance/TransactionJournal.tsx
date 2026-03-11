import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import { finance, system, type ListTransactionsFilter } from "@/infrastructure/tauri-bridge";
import {
  formatMoney,
  formatDate,
  TRANSACTION_TYPE_LABELS,
  transactionDirectionColor,
} from "@/shared/orderLabels";
import { FinanceNav } from "./FinanceNav";

const INPUT = "px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

const TYPE_OPTIONS = [
  { value: "", label: "Все типы" },
  { value: "order_payment_in", label: "Оплата заказа" },
  { value: "order_refund_out", label: "Возврат клиенту" },
  { value: "other_income_in", label: "Прочий доход" },
  { value: "company_expense_out", label: "Расход компании" },
  { value: "transfer_between_accounts", label: "Перевод" },
  { value: "supplier_debt_opened", label: "Открытие долга" },
  { value: "supplier_debt_paid", label: "Оплата долга" },
  { value: "partner_paid_company_expense", label: "Партнёр оплатил" },
  { value: "company_reimbursed_partner", label: "Возмещение партнёру" },
  { value: "partner_profit_payout", label: "Выплата прибыли" },
  { value: "partner_draw", label: "Draw" },
  { value: "adjustment", label: "Корректировка" },
];

export function TransactionJournal() {
  const [filterType, setFilterType] = useState("");
  const [filterAccountId, setFilterAccountId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filter: ListTransactionsFilter = {
    transaction_type: filterType || null,
    account_id: filterAccountId,
    date_from: dateFrom || null,
    date_to: dateTo || null,
  };

  const { data: transactions } = useTauriCommand(
    useCallback(() => finance.listTransactions(filter), [filterType, filterAccountId, dateFrom, dateTo]),
    [filterType, filterAccountId, dateFrom, dateTo]
  );

  const { data: accounts } = useTauriCommand(
    useCallback(() => finance.listAccounts(), []),
    []
  );

  const activeAccounts = (accounts ?? []).filter((a) => a.is_active);

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-semibold">Финансы</h1>
        <p className="text-gray-500 mt-1">Журнал всех финансовых операций</p>
      </div>
      <FinanceNav />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className={INPUT}>
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={filterAccountId ?? ""}
          onChange={(e) => setFilterAccountId(e.target.value ? Number(e.target.value) : null)}
          className={INPUT}
        >
          <option value="">Все счета</option>
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={INPUT}
          placeholder="С"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={INPUT}
          placeholder="По"
        />
        {(filterType || filterAccountId || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setFilterType("");
              setFilterAccountId(null);
              setDateFrom("");
              setDateTo("");
            }}
            className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            Сбросить
          </button>
        )}
        <div className="ml-auto">
          <button
            onClick={async () => {
              try {
                const path = await system.exportTransactionsCsv();
                toast.success(`Экспорт сохранён:\n${path}`, { duration: 5000 });
              } catch (err) {
                toast.error(String(err));
              }
            }}
            className="px-3 py-1.5 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Экспорт CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Дата</th>
              <th className="px-4 py-3 font-medium">Тип</th>
              <th className="px-4 py-3 font-medium">Описание</th>
              <th className="px-4 py-3 font-medium">Счёт</th>
              <th className="px-4 py-3 font-medium">Заказ</th>
              <th className="px-4 py-3 font-medium text-right">Сумма</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(transactions ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Нет операций
                </td>
              </tr>
            ) : (
              (transactions ?? []).map((tx) => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                    {formatDate(tx.transaction_date)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-block px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                      {TRANSACTION_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">
                    {tx.description ?? "—"}
                    {tx.partner_name && (
                      <span className="ml-2 text-xs text-gray-400">({tx.partner_name})</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {tx.account_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {tx.order_number ? (
                      <span className="font-mono text-blue-600">{tx.order_number}</span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono font-medium whitespace-nowrap ${transactionDirectionColor(tx.direction)}`}>
                    {tx.direction === "in" ? "+" : tx.direction === "out" ? "−" : ""}{formatMoney(tx.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

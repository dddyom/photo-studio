import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import { finance } from "@/infrastructure/tauri-bridge";
import { formatMoney, ACCOUNT_TYPE_LABELS } from "@/shared/orderLabels";
import { FinanceNav } from "./FinanceNav";
import { IncomeExpenseModal } from "./components/IncomeExpenseModal";
import { TransferModal } from "./components/TransferModal";

export function FinanceDashboard() {
  const navigate = useNavigate();
  const { data: summary, refetch } = useTauriCommand(
    useCallback(() => finance.getSummary(), []),
    []
  );
  const { data: accounts } = useTauriCommand(
    useCallback(() => finance.listAccounts(), []),
    []
  );

  const [modal, setModal] = useState<"income" | "expense" | "transfer" | null>(null);

  const activeAccounts = (accounts ?? []).filter((a) => a.is_active);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Финансы</h1>
          <p className="text-gray-500 mt-1">Счета, операции, долги и расчёты с партнёрами</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModal("income")}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
          >
            + Доход
          </button>
          <button
            onClick={() => setModal("expense")}
            className="px-4 py-2 bg-red-500 text-white text-sm rounded-md hover:bg-red-600 transition-colors"
          >
            + Расход
          </button>
          <button
            onClick={() => setModal("transfer")}
            className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
          >
            Перевод
          </button>
        </div>
      </div>

      <FinanceNav />

      {summary && (
        <div className="space-y-6">
          {/* Account balances */}
          <section>
            <h2 className="text-lg font-medium mb-3">Счета компании</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {summary.account_balances.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-white border border-gray-200 rounded-md p-4"
                >
                  <div className="text-sm text-gray-500 mb-1">
                    {ACCOUNT_TYPE_LABELS[acc.account_type] ?? acc.account_type}
                  </div>
                  <div className="text-lg font-semibold">{acc.name}</div>
                  <div className={`text-2xl font-bold mt-2 font-mono ${acc.balance >= 0 ? "text-gray-900" : "text-red-600"}`}>
                    {formatMoney(acc.balance)} <span className="text-sm font-normal text-gray-400">₸</span>
                  </div>
                </div>
              ))}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="text-sm text-blue-600 mb-1">Итого</div>
                <div className="text-lg font-semibold text-blue-900">Все счета</div>
                <div className="text-2xl font-bold mt-2 font-mono text-blue-700">
                  {formatMoney(summary.total_balance)} <span className="text-sm font-normal text-blue-400">₸</span>
                </div>
              </div>
            </div>
          </section>

          {/* Key figures */}
          <section>
            <h2 className="text-lg font-medium mb-3">Ключевые показатели</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div
                className="bg-white border border-gray-200 rounded-md p-4 cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => navigate("/finance/debts")}
              >
                <div className="text-sm text-gray-500">Долги поставщикам</div>
                <div className={`text-2xl font-bold mt-1 font-mono ${summary.supplier_debt_outstanding > 0 ? "text-orange-600" : "text-green-600"}`}>
                  {formatMoney(summary.supplier_debt_outstanding)} ₸
                </div>
                <div className="text-xs text-gray-400 mt-1">Сумма открытых обязательств</div>
              </div>
              <div
                className="bg-white border border-gray-200 rounded-md p-4 cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => navigate("/finance/transactions")}
              >
                <div className="text-sm text-gray-500">Журнал операций</div>
                <div className="text-lg font-semibold mt-1 text-blue-600">Все транзакции &rarr;</div>
                <div className="text-xs text-gray-400 mt-1">Доходы, расходы, переводы</div>
              </div>
              <div
                className="bg-white border border-gray-200 rounded-md p-4 cursor-pointer hover:border-gray-300 transition-colors"
                onClick={() => navigate("/finance/closing")}
              >
                <div className="text-sm text-gray-500">Закрытие периода</div>
                <div className="text-lg font-semibold mt-1 text-blue-600">Прибыль и начисления &rarr;</div>
                <div className="text-xs text-gray-400 mt-1">Cash-basis расчёт, деление 50/50</div>
              </div>
            </div>
          </section>

          {/* Partner summaries */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Расчёты с партнёрами</h2>
              <button
                onClick={() => navigate("/finance/partners")}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Подробнее &rarr;
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {summary.partner_summaries.map((ps) => (
                <div
                  key={ps.partner_id}
                  className="bg-white border border-gray-200 rounded-md p-4 cursor-pointer hover:border-gray-300 transition-colors"
                  onClick={() => navigate("/finance/partners")}
                >
                  <div className="text-lg font-semibold mb-3">{ps.partner_name}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div className="text-gray-500">Вложено:</div>
                    <div className="text-right font-mono">{formatMoney(ps.contributions)}</div>
                    <div className="text-gray-500">Начислено прибыли:</div>
                    <div className="text-right font-mono">{formatMoney(ps.profit_accrued)}</div>
                    <div className="text-gray-500">Выплачено прибыли:</div>
                    <div className="text-right font-mono">{formatMoney(ps.profit_paid)}</div>
                    <div className="text-gray-500">Draw (авансы):</div>
                    <div className="text-right font-mono">{formatMoney(ps.draws)}</div>
                    <div className="text-gray-500">Возмещения:</div>
                    <div className="text-right font-mono">{formatMoney(ps.reimbursements)}</div>
                  </div>
                  <div className="border-t border-gray-100 mt-3 pt-3 flex items-center justify-between">
                    <span className="font-medium">
                      {ps.balance >= 0
                        ? "Компания должна партнёру"
                        : "Партнёр должен компании"}
                    </span>
                    <span className={`text-xl font-bold font-mono ${ps.balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                      {formatMoney(Math.abs(ps.balance))} ₸
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {modal === "income" && (
        <IncomeExpenseModal
          type="income"
          accounts={activeAccounts}
          onClose={() => setModal(null)}
          onDone={refetch}
        />
      )}
      {modal === "expense" && (
        <IncomeExpenseModal
          type="expense"
          accounts={activeAccounts}
          onClose={() => setModal(null)}
          onDone={refetch}
        />
      )}
      {modal === "transfer" && (
        <TransferModal
          accounts={activeAccounts}
          onClose={() => setModal(null)}
          onDone={refetch}
        />
      )}
    </div>
  );
}

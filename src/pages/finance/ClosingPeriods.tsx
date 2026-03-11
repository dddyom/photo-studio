import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import { finance } from "@/infrastructure/tauri-bridge";
import { formatMoney, formatDate } from "@/shared/orderLabels";
import { FinanceNav } from "./FinanceNav";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodLabel(p: string): string {
  const [y, m] = p.split("-");
  const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];
  const mi = parseInt(m, 10) - 1;
  return `${months[mi] ?? m} ${y}`;
}

export function ClosingPeriods() {
  const [period, setPeriod] = useState(currentPeriod());
  const { data: closedPeriods, refetch } = useTauriCommand(
    useCallback(() => finance.listClosingPeriods(), []),
    []
  );
  const { data: summary, refetch: refetchSummary } = useTauriCommand(
    useCallback(() => finance.getSummary(), []),
    []
  );

  const [closing, setClosing] = useState(false);
  const [preview, setPreview] = useState<{
    income: number;
    expense: number;
    profit: number;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const alreadyClosed = (closedPeriods ?? []).find((cp) => cp.period === period);

  // Preview: simulate close by fetching transactions for period
  const doPreview = async () => {
    setPreviewing(true);
    try {
      const periodStart = `${period}-01`;
      const [y, m] = period.split("-").map(Number);
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      const periodEnd = `${ny}-${String(nm).padStart(2, "0")}-01`;

      // Fetch all transactions for period
      const txs = await finance.listTransactions({
        date_from: periodStart,
        date_to: periodEnd,
      });

      const incomeTypes = ["order_payment_in", "other_income_in"];
      const expenseTypes = ["company_expense_out", "supplier_debt_paid", "order_refund_out"];

      // Filter by transaction_date within range (list already filtered by backend, but date_to is <=)
      const income = txs
        .filter((t) => incomeTypes.includes(t.transaction_type) && t.transaction_date >= periodStart && t.transaction_date < periodEnd)
        .reduce((s, t) => s + t.amount, 0);

      const expense = txs
        .filter((t) => expenseTypes.includes(t.transaction_type) && t.transaction_date >= periodStart && t.transaction_date < periodEnd)
        .reduce((s, t) => s + t.amount, 0);

      setPreview({ income, expense, profit: income - expense });
    } catch (err) {
      toast.error(String(err));
    } finally {
      setPreviewing(false);
    }
  };

  const doClose = async (force: boolean) => {
    setClosing(true);
    try {
      const result = await finance.closePeriod({ period, force: force || null });
      toast.success(`Период ${periodLabel(period)} закрыт. Прибыль: ${formatMoney(result.profit)} ₸`);
      setPreview(null);
      refetch();
      refetchSummary();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setClosing(false);
    }
  };

  const partners = summary?.partner_summaries ?? [];

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-semibold">Финансы</h1>
        <p className="text-gray-500 mt-1">Закрытие периода и расчёт прибыли</p>
      </div>
      <FinanceNav />

      {/* Period selector */}
      <section className="bg-white border border-gray-200 rounded-md p-5 mb-6">
        <h2 className="text-lg font-medium mb-3">Закрыть период</h2>
        <p className="text-sm text-gray-500 mb-4">
          При закрытии периода рассчитывается прибыль по кассовому методу (доходы минус расходы) и начисляется каждому партнёру по 50%.
        </p>

        <div className="flex items-end gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Период (ГГГГ-ММ)</label>
            <input
              type="month"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPreview(null);
              }}
              className="px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <button
            onClick={doPreview}
            disabled={previewing}
            className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {previewing ? "Считаю..." : "Предпросмотр"}
          </button>
        </div>

        {alreadyClosed && !preview && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
            Период {periodLabel(period)} уже закрыт.
            Прибыль: <strong>{formatMoney(alreadyClosed.profit)} ₸</strong>.
            Можно пересчитать с помощью кнопки ниже.
          </div>
        )}

        {preview && (
          <div className="mt-4 space-y-4">
            <div className="bg-gray-50 rounded-md p-4">
              <h3 className="font-medium mb-3">Расчёт за {periodLabel(period)}</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Доходы</div>
                  <div className="text-xl font-bold font-mono text-green-600">
                    +{formatMoney(preview.income)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Оплаты заказов + прочий доход</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Расходы</div>
                  <div className="text-xl font-bold font-mono text-red-600">
                    −{formatMoney(preview.expense)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Расходы + оплата долгов + возвраты</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Прибыль</div>
                  <div className={`text-xl font-bold font-mono ${preview.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                    {formatMoney(preview.profit)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Cash-basis</div>
                </div>
              </div>
            </div>

            {/* Per-partner accrual preview */}
            <div className="bg-blue-50 rounded-md p-4">
              <h3 className="font-medium mb-2">Начисление партнёрам (50/50)</h3>
              <div className="space-y-1 text-sm">
                {partners.map((ps) => (
                  <div key={ps.partner_id} className="flex justify-between">
                    <span>{ps.partner_name}</span>
                    <span className={`font-mono font-medium ${preview.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                      {formatMoney(preview.profit * 0.5)} ₸
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => doClose(!!alreadyClosed)}
                disabled={closing}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {closing
                  ? "Закрываю..."
                  : alreadyClosed
                  ? "Пересчитать и закрыть"
                  : "Закрыть период"}
              </button>
              <button
                onClick={() => setPreview(null)}
                className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
            </div>
          </div>
        )}
      </section>

      {/* History */}
      <section>
        <h2 className="text-lg font-medium mb-3">История закрытий</h2>
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Период</th>
                <th className="px-4 py-3 font-medium text-right">Доходы</th>
                <th className="px-4 py-3 font-medium text-right">Расходы</th>
                <th className="px-4 py-3 font-medium text-right">Прибыль</th>
                <th className="px-4 py-3 font-medium text-right">На партнёра (50%)</th>
                <th className="px-4 py-3 font-medium">Закрыт</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(closedPeriods ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Нет закрытых периодов
                  </td>
                </tr>
              ) : (
                (closedPeriods ?? []).map((cp) => (
                  <tr key={cp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{periodLabel(cp.period)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-green-600">
                      +{formatMoney(cp.total_income)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-red-600">
                      −{formatMoney(cp.total_expense)}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-medium ${cp.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                      {formatMoney(cp.profit)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-gray-600">
                      {formatMoney(cp.profit * 0.5)}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">
                      {cp.closed_at ? formatDate(cp.closed_at) : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

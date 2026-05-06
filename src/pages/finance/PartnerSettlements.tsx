import { useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import { finance, type CompanyAccount, type PartnerSummary } from "@/infrastructure/tauri-bridge";
import {
  formatMoney,
  formatDate,
  SETTLEMENT_TYPE_LABELS,
  SETTLEMENT_TYPE_HINTS,
} from "@/shared/orderLabels";
import { FinanceNav } from "./FinanceNav";

const INPUT = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

type Period = "month" | "year" | "all";

const MONTH_NAMES = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

function periodRange(period: Period): { from: string | null; to: string | null; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === "month") {
    const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const last = new Date(y, m + 1, 0).getDate();
    const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
    return { from, to, label: `${MONTH_NAMES[m]} ${y}` };
  }
  if (period === "year") {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}` };
  }
  return { from: null, to: null, label: "всё время" };
}

export function PartnerSettlements() {
  const [period, setPeriod] = useState<Period>("month");
  const range = useMemo(() => periodRange(period), [period]);

  const fetchSummaries = useCallback(
    () => finance.listPartnerSummaries({ date_from: range.from, date_to: range.to }),
    [range.from, range.to],
  );
  const { data: partnerSummaries, refetch: refetchSummary } = useTauriCommand(
    fetchSummaries,
    [range.from, range.to],
  );
  const { data: entries, refetch: refetchEntries } = useTauriCommand(
    useCallback(() => finance.listPartnerSettlements(), []),
    []
  );
  const { data: accounts } = useTauriCommand(
    useCallback(() => finance.listAccounts(), []),
    []
  );

  const activeAccounts = (accounts ?? []).filter((a) => a.is_active);
  const partners = partnerSummaries ?? [];

  const [modal, setModal] = useState<{
    type: "contribution" | "reimbursement" | "draw" | "profit_payout";
    partnerId: number;
    partnerName: string;
  } | null>(null);

  const refetchAll = () => {
    refetchSummary();
    refetchEntries();
  };

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-semibold">Финансы</h1>
        <p className="text-gray-500 mt-1">Расчёты с партнёрами</p>
      </div>
      <FinanceNav />

      {/* Period selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">Активность:</span>
        {([
          { key: "month" as const, label: "Этот месяц" },
          { key: "year" as const, label: "Этот год" },
          { key: "all" as const, label: "За всё время" },
        ]).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              period === opt.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Partner cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {partners.map((ps) => (
          <PartnerCard
            key={ps.partner_id}
            partner={ps}
            periodLabel={range.label}
            onAction={(type) =>
              setModal({ type, partnerId: ps.partner_id, partnerName: ps.partner_name })
            }
          />
        ))}
      </div>

      {/* History */}
      <section>
        <h2 className="text-lg font-medium mb-3">История операций</h2>
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Дата</th>
                <th className="px-4 py-3 font-medium">Партнёр</th>
                <th className="px-4 py-3 font-medium">Тип</th>
                <th className="px-4 py-3 font-medium">Описание</th>
                <th className="px-4 py-3 font-medium">Период</th>
                <th className="px-4 py-3 font-medium text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(entries ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Нет записей
                  </td>
                </tr>
              ) : (
                (entries ?? []).map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                      {formatDate(e.created_at)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{e.partner_name}</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-block px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                        {SETTLEMENT_TYPE_LABELS[e.entry_type] ?? e.entry_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">
                      {e.description ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 font-mono">
                      {e.period ?? "—"}
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-medium ${
                      ["contribution", "profit_accrual"].includes(e.entry_type)
                        ? "text-green-600"
                        : "text-red-600"
                    }`}>
                      {["contribution", "profit_accrual"].includes(e.entry_type) ? "+" : "−"}
                      {formatMoney(Math.abs(e.amount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modal && (
        <PartnerActionModal
          type={modal.type}
          partnerId={modal.partnerId}
          partnerName={modal.partnerName}
          accounts={activeAccounts}
          onClose={() => setModal(null)}
          onDone={refetchAll}
        />
      )}
    </div>
  );
}

// ── Partner summary card ─────────────────────────────────────────────

function PartnerCard({
  partner,
  periodLabel,
  onAction,
}: {
  partner: PartnerSummary;
  periodLabel: string;
  onAction: (type: "contribution" | "reimbursement" | "draw" | "profit_payout") => void;
}) {
  const ps = partner;
  const totalWithdrawn = ps.profit_paid + ps.draws;
  const rows = [
    { label: "Вложено в бизнес", value: ps.contributions, hint: SETTLEMENT_TYPE_HINTS.contribution, positive: true },
    { label: "Возвращено вложений", value: ps.reimbursements, hint: SETTLEMENT_TYPE_HINTS.reimbursement, positive: false },
  ];
  const withdrawals = [
    { label: "Выплачено прибыли", value: ps.profit_paid, hint: SETTLEMENT_TYPE_HINTS.profit_payout },
    { label: "Draw (авансы)", value: ps.draws, hint: SETTLEMENT_TYPE_HINTS.draw },
  ];
  if (ps.adjustments !== 0) {
    rows.push({ label: "Корректировки", value: ps.adjustments, hint: "", positive: ps.adjustments > 0 });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-md p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg font-semibold">{ps.partner_name}</h3>
      </div>

      {/* Lifetime balance: company's standing debt to partner */}
      <div className="bg-gray-50 rounded-md p-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">
              {ps.balance >= 0
                ? "Компания должна партнёру"
                : "Партнёр должен компании"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              За всё время. = вложения − возмещения
            </div>
          </div>
          <span className={`text-xl font-bold font-mono ${ps.balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {formatMoney(Math.abs(ps.balance))} ₸
          </span>
        </div>
      </div>

      {/* Period activity */}
      <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">
        Активность · {periodLabel}
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm group">
            <span className="text-gray-600" title={r.hint}>{r.label}</span>
            <span className={`font-mono ${r.value > 0 ? (r.positive ? "text-green-600" : "text-red-600") : "text-gray-400"}`}>
              {r.value > 0 ? (r.positive ? "+" : "−") : ""}{formatMoney(Math.abs(r.value))}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 mt-3 pt-3">
        <div className="text-xs uppercase tracking-wide text-gray-400 mb-2">Выведено · {periodLabel}</div>
        <div className="space-y-1">
          {withdrawals.map((w) => (
            <div key={w.label} className="flex items-center justify-between text-sm">
              <span className="text-gray-600" title={w.hint}>{w.label}</span>
              <span className="font-mono text-gray-700">{formatMoney(w.value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between text-sm font-medium pt-1 border-t border-gray-100">
            <span className="text-gray-700">Итого снятий</span>
            <span className="font-mono">{formatMoney(totalWithdrawn)} ₸</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button
          onClick={() => onAction("contribution")}
          className="px-3 py-1.5 text-xs bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100 transition-colors"
        >
          + Вклад
        </button>
        <button
          onClick={() => onAction("reimbursement")}
          className="px-3 py-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-md hover:bg-orange-100 transition-colors"
        >
          Возврат вложений
        </button>
        <button
          onClick={() => onAction("draw")}
          className="px-3 py-1.5 text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md hover:bg-yellow-100 transition-colors"
        >
          Draw (аванс)
        </button>
        <button
          onClick={() => onAction("profit_payout")}
          className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
        >
          Выплата прибыли
        </button>
      </div>
    </div>
  );
}

// ── Partner action modal ─────────────────────────────────────────────

const ACTION_CONFIG = {
  contribution: {
    title: "Вклад партнёра",
    hint: "Партнёр вносит деньги в бизнес из личных средств. Деньги поступают на счёт компании.",
    descPlaceholder: "За что вложены средства",
    buttonLabel: "Записать вклад",
    buttonClass: "bg-green-600 hover:bg-green-700",
  },
  reimbursement: {
    title: "Возврат вложений партнёру",
    hint: "Компания возвращает ранее вложенные партнёром средства. Это НЕ выплата прибыли.",
    descPlaceholder: "За какой вклад возмещение",
    buttonLabel: "Записать возврат",
    buttonClass: "bg-orange-600 hover:bg-orange-700",
  },
  draw: {
    title: "Draw (авансовое изъятие)",
    hint: "Партнёр берёт деньги авансом, ещё до распределения прибыли. Уменьшает итоговый баланс партнёра.",
    descPlaceholder: "Причина draw",
    buttonLabel: "Записать draw",
    buttonClass: "bg-yellow-600 hover:bg-yellow-700",
  },
  profit_payout: {
    title: "Выплата прибыли",
    hint: "Фактическая выплата начисленной за период прибыли. Сначала закройте период, чтобы прибыль была начислена.",
    descPlaceholder: "За какой период",
    buttonLabel: "Записать выплату",
    buttonClass: "bg-blue-600 hover:bg-blue-700",
  },
};

function PartnerActionModal({
  type,
  partnerId,
  partnerName,
  accounts,
  onClose,
  onDone,
}: {
  type: "contribution" | "reimbursement" | "draw" | "profit_payout";
  partnerId: number;
  partnerName: string;
  accounts: CompanyAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const config = ACTION_CONFIG[type];
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Введите сумму > 0");
      return;
    }

    setSubmitting(true);
    try {
      const input = {
        partner_id: partnerId,
        amount: amt,
        account_id: accountId,
        description: description || null,
      };

      switch (type) {
        case "contribution":
          await finance.registerPartnerContribution(input);
          break;
        case "reimbursement":
          await finance.reimbursePartner(input);
          break;
        case "draw":
          await finance.registerPartnerDraw(input);
          break;
        case "profit_payout":
          await finance.registerPartnerProfitPayout(input);
          break;
      }

      toast.success("Операция записана");
      onDone();
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-20 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 mb-10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">{config.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-blue-50 rounded-md p-3 text-xs text-blue-700">{config.hint}</div>

          <div className="text-sm font-medium">Партнёр: {partnerName}</div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Сумма *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={INPUT}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Счёт *</label>
            <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} className={INPUT}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.balance)} ₸)</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              {type === "contribution"
                ? "Деньги поступят на этот счёт"
                : "Деньги будут списаны с этого счёта"}
            </p>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Описание</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT}
              placeholder={config.descPlaceholder}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">Отмена</button>
            <button
              onClick={submit}
              disabled={submitting}
              className={`px-4 py-2 text-white text-sm rounded-md transition-colors disabled:opacity-50 ${config.buttonClass}`}
            >
              {submitting ? "..." : config.buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

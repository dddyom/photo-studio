import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import { finance, type CompanyAccount } from "@/infrastructure/tauri-bridge";
import {
  formatMoney,
  formatDate,
  liabilityStatusLabel,
  liabilityStatusColor,
} from "@/shared/orderLabels";
import { FinanceNav } from "./FinanceNav";

const INPUT = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

export function SupplierDebts() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { data: debts, refetch } = useTauriCommand(
    useCallback(() => finance.listLiabilities(statusFilter), [statusFilter]),
    [statusFilter]
  );
  const { data: accounts } = useTauriCommand(
    useCallback(() => finance.listAccounts(), []),
    []
  );
  const activeAccounts = (accounts ?? []).filter((a) => a.is_active);

  const [showCreate, setShowCreate] = useState(false);
  const [payingId, setPayingId] = useState<number | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-semibold">Финансы</h1>
          <p className="text-gray-500 mt-1">Учёт долгов поставщикам</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
        >
          + Новый долг
        </button>
      </div>
      <FinanceNav />

      {/* Status filter */}
      <div className="flex gap-2 mb-4">
        {[
          { value: null, label: "Все" },
          { value: "open", label: "Открытые" },
          { value: "paid", label: "Оплаченные" },
        ].map((opt) => (
          <button
            key={opt.value ?? "all"}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              statusFilter === opt.value
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Debts list */}
      <div className="space-y-3">
        {(debts ?? []).length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-md p-8 text-center text-gray-400">
            Нет обязательств
          </div>
        ) : (
          (debts ?? []).map((d) => (
            <div key={d.id} className="bg-white border border-gray-200 rounded-md p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">{d.counterparty_name}</span>
                    <span className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${liabilityStatusColor(d.status)}`}>
                      {liabilityStatusLabel(d.status)}
                    </span>
                  </div>
                  {d.description && (
                    <div className="text-sm text-gray-500 mt-1">{d.description}</div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    Открыт: {formatDate(d.opened_at)}
                    {d.due_date && <span className="ml-3">Срок: {formatDate(d.due_date)}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500">Сумма долга</div>
                  <div className="text-lg font-bold font-mono">{formatMoney(d.original_amount)} ₸</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Оплачено: {formatMoney(d.paid_amount)}</span>
                  <span>Остаток: {formatMoney(d.remaining_amount)}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${d.status === "paid" ? "bg-green-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(100, (d.paid_amount / d.original_amount) * 100)}%` }}
                  />
                </div>
              </div>

              {d.status === "open" && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => setPayingId(d.id)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Оплатить
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCreate && (
        <CreateDebtModal onClose={() => setShowCreate(false)} onDone={refetch} />
      )}

      {payingId && (
        <PayDebtModal
          liabilityId={payingId}
          debts={debts ?? []}
          accounts={activeAccounts}
          onClose={() => setPayingId(null)}
          onDone={refetch}
        />
      )}
    </div>
  );
}

// ── Create debt modal ────────────────────────────────────────────────

function CreateDebtModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!name.trim()) { toast.error("Введите имя контрагента"); return; }
    if (!amt || amt <= 0) { toast.error("Введите сумму > 0"); return; }

    setSubmitting(true);
    try {
      await finance.openLiability({
        liability_type: "supplier_debt",
        counterparty_name: name.trim(),
        original_amount: amt,
        description: description || null,
        due_date: dueDate || null,
      });
      toast.success("Долг зарегистрирован");
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
          <h2 className="text-base font-semibold">Новый долг поставщику</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400">
            Товар получен, но оплата ещё не произведена. Движения денег нет — только фиксация обязательства.
          </p>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Контрагент *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT} placeholder="ООО Поставщик" autoFocus />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Сумма долга *</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={INPUT} placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Описание</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} placeholder="За что" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Срок оплаты</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={INPUT} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">Отмена</button>
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
              {submitting ? "..." : "Зарегистрировать долг"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pay debt modal ───────────────────────────────────────────────────

import type { Liability } from "@/infrastructure/tauri-bridge";

function PayDebtModal({
  liabilityId,
  debts,
  accounts,
  onClose,
  onDone,
}: {
  liabilityId: number;
  debts: Liability[];
  accounts: CompanyAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const debt = debts.find((d) => d.id === liabilityId);
  const [amount, setAmount] = useState(debt?.remaining_amount?.toString() ?? "");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!debt) return null;

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Введите сумму > 0"); return; }

    setSubmitting(true);
    try {
      await finance.payLiability({
        liability_id: liabilityId,
        amount: amt,
        account_id: accountId,
        description: description || null,
      });
      toast.success(amt >= debt.remaining_amount - 0.01 ? "Долг полностью погашен" : "Частичная оплата зарегистрирована");
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
          <h2 className="text-base font-semibold">Оплата долга</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-gray-50 rounded-md p-3 text-sm">
            <div><strong>{debt.counterparty_name}</strong></div>
            <div className="text-gray-500 mt-1">
              Долг: {formatMoney(debt.original_amount)} ₸ &middot;
              Оплачено: {formatMoney(debt.paid_amount)} ₸ &middot;
              <strong> Остаток: {formatMoney(debt.remaining_amount)} ₸</strong>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Сумма оплаты *</label>
            <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Со счёта *</label>
            <select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))} className={INPUT}>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.balance)} ₸)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Комментарий</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">Отмена</button>
            <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
              {submitting ? "..." : "Оплатить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

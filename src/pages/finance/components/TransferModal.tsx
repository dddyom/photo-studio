import { useState } from "react";
import toast from "react-hot-toast";
import { finance, type CompanyAccount } from "@/infrastructure/tauri-bridge";

const INPUT = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

interface Props {
  accounts: CompanyAccount[];
  onClose: () => void;
  onDone: () => void;
}

export function TransferModal({ accounts, onClose, onDone }: Props) {
  const [amount, setAmount] = useState("");
  const [fromId, setFromId] = useState(accounts[0]?.id ?? 0);
  const [toId, setToId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? 0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Введите сумму > 0");
      return;
    }
    if (fromId === toId) {
      toast.error("Счёт-источник и счёт-назначение должны отличаться");
      return;
    }

    setSubmitting(true);
    try {
      await finance.transferBetweenAccounts({
        amount: amt,
        from_account_id: fromId,
        to_account_id: toId,
        description: description || null,
        transaction_date: date || null,
      });
      toast.success("Перевод выполнен");
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
          <h2 className="text-base font-semibold">Перевод между счетами</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400">
            Деньги перемещаются между счетами компании. Общий баланс не меняется.
          </p>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Откуда *</label>
              <select value={fromId} onChange={(e) => setFromId(Number(e.target.value))} className={INPUT}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Куда *</label>
              <select value={toId} onChange={(e) => setToId(Number(e.target.value))} className={INPUT}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Описание</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT}
              placeholder="Причина перевода"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Дата</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {submitting ? "..." : "Перевести"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import toast from "react-hot-toast";
import { finance, type CompanyAccount } from "@/infrastructure/tauri-bridge";

const INPUT = "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

interface Props {
  type: "income" | "expense";
  accounts: CompanyAccount[];
  onClose: () => void;
  onDone: () => void;
}

export function IncomeExpenseModal({ type, accounts, onClose, onDone }: Props) {
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? 0);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);

  const isIncome = type === "income";
  const title = isIncome ? "Прочий доход" : "Расход компании";

  const submit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      toast.error("Введите сумму > 0");
      return;
    }
    if (!accountId) {
      toast.error("Выберите счёт");
      return;
    }

    setSubmitting(true);
    try {
      if (isIncome) {
        await finance.registerOtherIncome({
          amount: amt,
          account_id: accountId,
          description: description || null,
          transaction_date: date || null,
        });
        toast.success("Доход зарегистрирован");
      } else {
        await finance.registerCompanyExpense({
          amount: amt,
          account_id: accountId,
          description: description || null,
          transaction_date: date || null,
        });
        toast.success("Расход зарегистрирован");
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-20 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 mb-10">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
        </div>
        <div className="p-5 space-y-3">
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
            <select
              value={accountId}
              onChange={(e) => setAccountId(Number(e.target.value))}
              className={INPUT}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Описание</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT}
              placeholder={isIncome ? "Источник дохода" : "На что потрачено"}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Дата</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={INPUT}
            />
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
              className={`px-4 py-2 text-white text-sm rounded-md transition-colors disabled:opacity-50 ${
                isIncome ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"
              }`}
            >
              {submitting ? "..." : isIncome ? "Записать доход" : "Записать расход"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

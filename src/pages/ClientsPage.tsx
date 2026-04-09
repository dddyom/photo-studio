import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  clients,
  pricing,
  catalogs,
  clientBalance,
  type Client,
  type CreateClientInput,
  type UpdateClientInput,
  type PricingProgram,
} from "@/infrastructure/tauri-bridge";
import { formatMoney, PAYMENT_METHOD_LABELS } from "@/shared/orderLabels";

export function ClientsPage() {
  const { data, loading, refetch } = useTauriCommand(clients.listAll);
  const { data: programs } = useTauriCommand(pricing.listPrograms);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [balanceClient, setBalanceClient] = useState<Client | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const activePrograms = (programs ?? []).filter((p) => p.is_active);

  const handleArchive = async (c: Client) => {
    if (!confirm(`Архивировать клиента "${c.name}"?`)) return;
    try {
      await clients.archive(c.id);
      toast.success("Клиент архивирован");
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleUnarchive = async (c: Client) => {
    try {
      await clients.unarchive(c.id);
      toast.success("Клиент восстановлен из архива");
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const handleDelete = async (c: Client) => {
    if (!confirm(`Удалить клиента "${c.name}" навсегда?`)) return;
    try {
      await clients.delete(c.id);
      toast.success("Клиент удалён");
      refetch();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const filtered = (data ?? []).filter((c) => showArchived || !c.is_archived);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Клиенты</h1>
        <button
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
          onClick={() => {
            setShowForm(!showForm);
            setEditingClient(null);
          }}
        >
          {showForm && !editingClient ? "Отмена" : "+ Добавить"}
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Показать архивных
        </label>
      </div>

      {showForm && !editingClient && (
        <CreateClientForm
          programs={activePrograms}
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      {editingClient && (
        <EditClientForm
          client={editingClient}
          programs={activePrograms}
          onSaved={() => {
            setEditingClient(null);
            refetch();
          }}
          onCancel={() => setEditingClient(null)}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-md p-5">
        {loading ? (
          <p className="text-gray-500">Загрузка...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Нет клиентов</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Имя
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Телефон
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Email
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Прайс
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Баланс
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Создан
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-2.5">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <ClientRow
                    key={c.id}
                    client={c}
                    programs={programs ?? []}
                    onEdit={() => {
                      setEditingClient(c);
                      setShowForm(false);
                    }}
                    onBalance={() => setBalanceClient(c)}
                    onArchive={() => handleArchive(c)}
                    onUnarchive={() => handleUnarchive(c)}
                    onDelete={() => handleDelete(c)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {balanceClient && (
        <ClientBalanceModal
          client={balanceClient}
          onClose={() => setBalanceClient(null)}
          onChanged={() => refetch()}
        />
      )}
    </div>
  );
}

function ClientRow({
  client: c,
  programs,
  onEdit,
  onBalance,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  client: Client;
  programs: PricingProgram[];
  onEdit: () => void;
  onBalance: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const programName = c.default_pricing_program_id
    ? programs.find((p) => p.id === c.default_pricing_program_id)?.name ?? "—"
    : "—";

  return (
    <tr className={`border-b border-gray-100 last:border-0 ${c.is_archived ? "opacity-50" : ""}`}>
      <td className="px-3 py-2.5">
        {c.name}
        {c.is_archived && <span className="ml-2 text-xs text-gray-400">(архив)</span>}
      </td>
      <td className="px-3 py-2.5">{c.phone ?? "—"}</td>
      <td className="px-3 py-2.5">{c.email ?? "—"}</td>
      <td className="px-3 py-2.5 text-sm text-gray-500">{programName}</td>
      <td className="px-3 py-2.5 text-right">
        {c.balance > 0.01 ? (
          <button onClick={onBalance} className="text-green-600 font-medium text-sm hover:text-green-700">
            {formatMoney(c.balance)} ₸
          </button>
        ) : (
          <span className="text-gray-300 text-sm">0</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-gray-500">
        {new Date(c.created_at).toLocaleDateString("ru")}
      </td>
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        {c.is_archived ? (
          <>
            <button
              onClick={onUnarchive}
              className="text-xs text-blue-600 hover:text-blue-700 mr-3"
            >
              Восстановить
            </button>
            <button
              onClick={onDelete}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Удалить
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onBalance}
              className="text-xs text-blue-600 hover:text-blue-700 mr-3"
            >
              Баланс
            </button>
            <button
              onClick={onEdit}
              className="text-xs text-blue-600 hover:text-blue-700 mr-3"
            >
              Изменить
            </button>
            <button
              onClick={onArchive}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Архив
            </button>
          </>
        )}
      </td>
    </tr>
  );
}

function CreateClientForm({
  programs,
  onCreated,
}: {
  programs: PricingProgram[];
  onCreated: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateClientInput>();

  const onSubmit = async (input: CreateClientInput) => {
    try {
      const payload = {
        ...input,
        default_pricing_program_id: input.default_pricing_program_id || null,
      };
      await clients.create(payload);
      toast.success("Клиент добавлен");
      reset();
      onCreated();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const inputCls = "w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4 mb-4">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px] flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Имя *</label>
          <input {...register("name", { required: true })} placeholder="Имя клиента" className={inputCls} />
          {errors.name && <p className="text-red-600 text-xs mt-0.5">Обязательное поле</p>}
        </div>
        <div className="min-w-[150px] w-[150px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Телефон</label>
          <input {...register("phone")} placeholder="+7 ..." className={inputCls} />
        </div>
        <div className="min-w-[180px] w-[180px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input {...register("email")} placeholder="email@example.com" className={inputCls} />
        </div>
        <div className="min-w-[160px] w-[160px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Прайс</label>
          <select {...register("default_pricing_program_id", { valueAsNumber: true })} className={inputCls}>
            <option value="">Не выбрана</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px] flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Заметки</label>
          <input {...register("notes")} placeholder="Заметки" className={inputCls} />
        </div>
        <button
          type="submit"
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap"
        >
          Сохранить
        </button>
      </form>
    </div>
  );
}

function EditClientForm({
  client,
  programs,
  onSaved,
  onCancel,
}: {
  client: Client;
  programs: PricingProgram[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { register, handleSubmit } = useForm<UpdateClientInput>({
    defaultValues: {
      name: client.name,
      phone: client.phone,
      email: client.email,
      default_pricing_program_id: client.default_pricing_program_id,
      notes: client.notes,
    },
  });

  const onSubmit = async (input: UpdateClientInput) => {
    try {
      const payload = {
        ...input,
        default_pricing_program_id: input.default_pricing_program_id || null,
      };
      await clients.update(client.id, payload);
      toast.success("Клиент обновлён");
      onSaved();
    } catch (err) {
      toast.error(String(err));
    }
  };

  const inputCls = "w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

  return (
    <div className="bg-white border border-blue-200 rounded-md p-4 mb-4">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
        <div className="text-xs font-medium text-blue-600 w-full -mb-1">Редактирование: {client.name}</div>
        <div className="min-w-[180px] flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Имя</label>
          <input {...register("name")} className={inputCls} />
        </div>
        <div className="min-w-[150px] w-[150px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Телефон</label>
          <input {...register("phone")} className={inputCls} />
        </div>
        <div className="min-w-[180px] w-[180px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
          <input {...register("email")} className={inputCls} />
        </div>
        <div className="min-w-[160px] w-[160px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Прайс</label>
          <select {...register("default_pricing_program_id", { valueAsNumber: true })} className={inputCls}>
            <option value="">Не выбрана</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="min-w-[150px] flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">Заметки</label>
          <input {...register("notes")} className={inputCls} />
        </div>
        <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors whitespace-nowrap">
          Сохранить
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors whitespace-nowrap">
          Отмена
        </button>
      </form>
    </div>
  );
}

// ── Client Balance Modal ────────────────────────────────────────────

const BALANCE_TX_TYPE_LABELS: Record<string, string> = {
  deposit: "Пополнение",
  withdraw: "Вывод",
  order_payment: "Оплата заказа",
  order_surplus: "Излишек по заказу",
};

const PAYMENT_METHODS = ["cash", "card", "bank_transfer"] as const;

function ClientBalanceModal({
  client,
  onClose,
  onChanged,
}: {
  client: Client;
  onClose: () => void;
  onChanged: () => void;
}) {
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

  const inputCls =
    "w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

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
                  className={inputCls}
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
                  className={inputCls}
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
                  className={inputCls}
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

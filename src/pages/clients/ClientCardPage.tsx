import { Fragment, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  clients,
  clientCard,
  clientBalance,
  pricing,
  orders,
  type ClientNote,
} from "@/infrastructure/tauri-bridge";
import {
  formatMoney,
  formatDate,
  formatDateTime,
  PRODUCTION_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  productionStatusColor,
  paymentStatusColor,
  deliveryStatusColor,
} from "@/shared/orderLabels";
import { OrderItemsList } from "@/shared/components/OrderItemsList";
import { ClientBalanceModal } from "./ClientBalanceModal";

const BALANCE_TX_TYPE_LABELS: Record<string, string> = {
  deposit: "Пополнение",
  withdraw: "Вывод",
  order_payment: "Оплата заказа",
  order_surplus: "Излишек по заказу",
};

export function ClientCardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const clientId = Number(id);

  const { data: client, refetch: refetchClient } = useTauriCommand(
    () => clients.get(clientId),
    [clientId],
  );
  const { data: summary, refetch: refetchSummary } = useTauriCommand(
    () => clientCard.summary(clientId),
    [clientId],
  );
  const { data: orderList, refetch: refetchOrders } = useTauriCommand(
    () => orders.list({ client_id: clientId, include_cancelled: true }),
    [clientId],
  );
  const { data: payments, refetch: refetchPayments } = useTauriCommand(
    () => clientCard.payments(clientId),
    [clientId],
  );
  const { data: deliveries, refetch: refetchDeliveries } = useTauriCommand(
    () => clientCard.deliveries(clientId),
    [clientId],
  );
  const { data: balanceHistory, refetch: refetchBalance } = useTauriCommand(
    () => clientBalance.history(clientId),
    [clientId],
  );
  const { data: programs } = useTauriCommand(pricing.listPrograms);

  const [showBalanceModal, setShowBalanceModal] = useState(false);

  const refetchAll = () => {
    refetchClient();
    refetchSummary();
    refetchOrders();
    refetchPayments();
    refetchDeliveries();
    refetchBalance();
  };

  if (!client) {
    return <p className="text-gray-500">Загрузка...</p>;
  }

  const programName = client.default_pricing_program_id
    ? programs?.find((p) => p.id === client.default_pricing_program_id)?.name ?? "—"
    : "—";

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate("/clients")}
            className="text-sm text-gray-500 hover:text-blue-600 mb-1"
          >
            ← К списку клиентов
          </button>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {client.name}
            {client.is_archived && (
              <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded">
                Архив
              </span>
            )}
          </h1>
          <div className="text-sm text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
            {client.phone && <span>📞 {client.phone}</span>}
            {client.email && <span>✉ {client.email}</span>}
            <span>Прайс: {programName}</span>
            <span>С нами с {formatDate(client.created_at)}</span>
          </div>
          {client.notes && (
            <p className="text-sm text-gray-600 mt-1 italic">{client.notes}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Баланс</div>
          <div
            className={`text-2xl font-semibold font-mono ${
              client.balance > 0.01 ? "text-green-600" : "text-gray-400"
            }`}
          >
            {formatMoney(client.balance)} ₸
          </div>
          <button
            onClick={() => setShowBalanceModal(true)}
            className="mt-1 text-xs text-blue-600 hover:text-blue-700"
          >
            Пополнить / вывести
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
          <StatCard label="Заказов" value={summary.orders_total} />
          <StatCard label="Активных" value={summary.orders_active} tone="blue" />
          <StatCard
            label="Оборот"
            value={`${formatMoney(summary.revenue)} ₸`}
          />
          <StatCard
            label="Средний чек"
            value={`${formatMoney(summary.avg_check)} ₸`}
          />
          <StatCard
            label="Текущий долг"
            value={`${formatMoney(summary.current_debt)} ₸`}
            tone={summary.current_debt > 0.01 ? "red" : "muted"}
          />
          {summary.overpaid_in_orders > 0.01 && (
            <StatCard
              label="Переплата в заказах"
              value={`${formatMoney(summary.overpaid_in_orders)} ₸`}
              tone="amber"
            />
          )}
          <StatCard
            label="Последний заказ"
            value={
              summary.last_order_at ? formatDate(summary.last_order_at) : "—"
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: orders + notes */}
        <div className="lg:col-span-2 space-y-4">
          <OrdersBlock orders={orderList ?? []} />
          <NotesBlock clientId={clientId} />
        </div>

        {/* Right: balance + payments + deliveries */}
        <div className="space-y-4">
          <BalanceHistoryBlock history={balanceHistory ?? []} />
          <PaymentsBlock payments={payments ?? []} />
          <DeliveriesBlock deliveries={deliveries ?? []} />
        </div>
      </div>

      {showBalanceModal && (
        <ClientBalanceModal
          client={client}
          onClose={() => setShowBalanceModal(false)}
          onChanged={refetchAll}
        />
      )}
    </div>
  );
}

// ── Stat card ───────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "blue" | "red" | "muted" | "amber";
}) {
  const valueColor =
    tone === "red"
      ? "text-red-600"
      : tone === "blue"
      ? "text-blue-600"
      : tone === "amber"
      ? "text-amber-600"
      : tone === "muted"
      ? "text-gray-400"
      : "text-gray-900";

  return (
    <div className="bg-white border border-gray-200 rounded-md px-3 py-2.5">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${valueColor}`}>{value}</div>
    </div>
  );
}

// ── Orders block ────────────────────────────────────────────────────

function OrdersBlock({
  orders: list,
}: {
  orders: ReadonlyArray<{
    id: number;
    number: string;
    production_status: string;
    payment_status: string;
    delivery_status: string;
    total_amount: number;
    debt_amount: number;
    created_at: string;
    due_date: string | null;
    items_count: number;
  }>;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const toggleExpanded = (orderId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <h3 className="text-base font-semibold mb-3">Заказы ({list.length})</h3>
      {list.length === 0 ? (
        <p className="text-gray-400 text-sm py-4 text-center">Нет заказов</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="text-left py-1.5">№</th>
                <th className="text-left py-1.5">Дата</th>
                <th className="text-left py-1.5">Статус</th>
                <th className="text-left py-1.5">Оплата</th>
                <th className="text-left py-1.5">Выдача</th>
                <th className="text-left py-1.5">Позиции</th>
                <th className="text-right py-1.5">Сумма</th>
                <th className="text-right py-1.5">Долг</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <Fragment key={o.id}>
                <tr className="border-t border-gray-100">
                  <td className="py-1.5">
                    <Link
                      to={`/orders/${o.id}`}
                      className="font-mono text-blue-600 hover:text-blue-700"
                    >
                      {o.number}
                    </Link>
                  </td>
                  <td className="py-1.5 text-gray-500">
                    {formatDate(o.created_at)}
                  </td>
                  <td className="py-1.5">
                    <span
                      className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${productionStatusColor(
                        o.production_status as never,
                      )}`}
                    >
                      {PRODUCTION_STATUS_LABELS[
                        o.production_status as keyof typeof PRODUCTION_STATUS_LABELS
                      ] ?? o.production_status}
                    </span>
                  </td>
                  <td className="py-1.5">
                    <span
                      className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${paymentStatusColor(
                        o.payment_status as never,
                      )}`}
                    >
                      {PAYMENT_STATUS_LABELS[
                        o.payment_status as keyof typeof PAYMENT_STATUS_LABELS
                      ] ?? o.payment_status}
                    </span>
                  </td>
                  <td className="py-1.5">
                    <span
                      className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${deliveryStatusColor(
                        o.delivery_status as never,
                      )}`}
                    >
                      {DELIVERY_STATUS_LABELS[
                        o.delivery_status as keyof typeof DELIVERY_STATUS_LABELS
                      ] ?? o.delivery_status}
                    </span>
                  </td>
                  <td className="py-1.5">
                    {o.items_count > 0 ? (
                      <button
                        onClick={() => toggleExpanded(o.id)}
                        title={expanded.has(o.id) ? "Свернуть позиции" : "Показать позиции"}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        {o.items_count} поз. {expanded.has(o.id) ? "▴" : "▾"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {formatMoney(o.total_amount)}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {o.debt_amount > 0.01 ? (
                      <span className="text-red-600">
                        {formatMoney(o.debt_amount)}
                      </span>
                    ) : (
                      <span className="text-gray-300">0</span>
                    )}
                  </td>
                </tr>
                {expanded.has(o.id) && (
                  <tr className="bg-gray-50/60">
                    <td colSpan={8} className="py-2 px-2">
                      <OrderItemsList orderId={o.id} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Balance history block ───────────────────────────────────────────

function BalanceHistoryBlock({
  history,
}: {
  history: ReadonlyArray<{
    id: number;
    transaction_type: string;
    direction: string;
    amount: number;
    order_id: number | null;
    order_number: string | null;
    created_at: string;
  }>;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <h3 className="text-base font-semibold mb-3">Баланс</h3>
      {history.length === 0 ? (
        <p className="text-gray-400 text-sm">Нет операций</p>
      ) : (
        <div className="space-y-1 text-sm max-h-72 overflow-y-auto">
          {history.map((tx) => (
            <div
              key={tx.id}
              className="flex justify-between items-start py-1 border-b border-gray-50 last:border-0"
            >
              <div className="min-w-0">
                <div className="text-gray-700">
                  {BALANCE_TX_TYPE_LABELS[tx.transaction_type] ??
                    tx.transaction_type}
                  {tx.order_id && tx.order_number && (
                    <Link
                      to={`/orders/${tx.order_id}`}
                      className="text-blue-600 hover:text-blue-700 ml-1 font-mono"
                    >
                      #{tx.order_number}
                    </Link>
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {formatDate(tx.created_at)}
                </div>
              </div>
              <span
                className={`font-mono font-medium shrink-0 ml-2 ${
                  tx.direction === "in" ? "text-green-600" : "text-red-500"
                }`}
              >
                {tx.direction === "in" ? "+" : "-"}
                {formatMoney(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Payments block ──────────────────────────────────────────────────

function PaymentsBlock({
  payments,
}: {
  payments: ReadonlyArray<{
    id: number;
    order_id: number;
    order_number: string;
    amount: number;
    payment_method: string;
    paid_at: string;
  }>;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <h3 className="text-base font-semibold mb-3">Платежи по заказам</h3>
      {payments.length === 0 ? (
        <p className="text-gray-400 text-sm">Нет платежей</p>
      ) : (
        <div className="space-y-1 text-sm max-h-72 overflow-y-auto">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex justify-between items-start py-1 border-b border-gray-50 last:border-0"
            >
              <div className="min-w-0">
                <Link
                  to={`/orders/${p.order_id}`}
                  className="font-mono text-blue-600 hover:text-blue-700"
                >
                  {p.order_number}
                </Link>
                <span className="text-gray-400 ml-2 text-xs">
                  {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                </span>
                <div className="text-xs text-gray-400">
                  {formatDateTime(p.paid_at)}
                </div>
              </div>
              <span className="font-mono font-medium text-green-600 shrink-0 ml-2">
                +{formatMoney(p.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Deliveries block ────────────────────────────────────────────────

function DeliveriesBlock({
  deliveries,
}: {
  deliveries: ReadonlyArray<{
    id: number;
    order_id: number;
    order_number: string;
    delivered_by: string | null;
    delivered_at: string;
  }>;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <h3 className="text-base font-semibold mb-3">Выдачи</h3>
      {deliveries.length === 0 ? (
        <p className="text-gray-400 text-sm">Не было выдач</p>
      ) : (
        <div className="space-y-1 text-sm max-h-72 overflow-y-auto">
          {deliveries.map((d) => (
            <div
              key={d.id}
              className="py-1 border-b border-gray-50 last:border-0"
            >
              <Link
                to={`/orders/${d.order_id}`}
                className="font-mono text-blue-600 hover:text-blue-700"
              >
                {d.order_number}
              </Link>
              {d.delivered_by && (
                <span className="text-gray-500 ml-2 text-xs">
                  ({d.delivered_by})
                </span>
              )}
              <div className="text-xs text-gray-400">
                {formatDateTime(d.delivered_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Notes block ─────────────────────────────────────────────────────

function NotesBlock({ clientId }: { clientId: number }) {
  const { data: notes, refetch } = useTauriCommand(
    () => clientCard.notes.list(clientId),
    [clientId],
  );
  const [newText, setNewText] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const addNote = async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;
    setAdding(true);
    try {
      await clientCard.notes.create(clientId, trimmed);
      setNewText("");
      refetch();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <h3 className="text-base font-semibold mb-3">Заметки и коммуникация</h3>

      <div className="flex gap-2 mb-3">
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              addNote();
            }
          }}
          placeholder="Добавить заметку..."
          className="flex-1 px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
        />
        <button
          onClick={addNote}
          disabled={adding || !newText.trim()}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {adding ? "..." : "Добавить"}
        </button>
      </div>

      {!notes || notes.length === 0 ? (
        <p className="text-gray-400 text-sm py-2">Нет заметок</p>
      ) : (
        <div className="space-y-2">
          {notes.map((n) => (
            <NoteRow
              key={n.id}
              note={n}
              editing={editingId === n.id}
              onStartEdit={() => setEditingId(n.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaved={() => {
                setEditingId(null);
                refetch();
              }}
              onDeleted={refetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteRow({
  note,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaved,
  onDeleted,
}: {
  note: ClientNote;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [text, setText] = useState(note.text);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Текст не может быть пустым");
      return;
    }
    setSaving(true);
    try {
      await clientCard.notes.update(note.id, trimmed);
      onSaved();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm("Удалить заметку?")) return;
    try {
      await clientCard.notes.delete(note.id);
      onDeleted();
    } catch (err) {
      toast.error(String(err));
    }
  };

  if (editing) {
    return (
      <div className="border border-blue-200 rounded-md p-2.5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500"
          autoFocus
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "..." : "Сохранить"}
          </button>
          <button
            onClick={() => {
              setText(note.text);
              onCancelEdit();
            }}
            className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200"
          >
            Отмена
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group border border-gray-100 rounded-md p-2.5 hover:border-gray-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm whitespace-pre-wrap flex-1">{note.text}</p>
        <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
          <button
            onClick={onStartEdit}
            className="text-xs text-gray-500 hover:text-blue-600"
          >
            Изм.
          </button>
          <button
            onClick={remove}
            className="text-xs text-red-500 hover:text-red-600"
          >
            Удл.
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-400 mt-1">
        {formatDateTime(note.created_at)}
        {note.updated_at !== note.created_at && (
          <span> · изм. {formatDateTime(note.updated_at)}</span>
        )}
      </div>
    </div>
  );
}

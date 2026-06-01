import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import { useTauriCommand } from "@/shared/hooks/useTauriCommand";
import {
  orders,
  orderItems,
  orderPayments,
  production,
  clients,
  catalogs,
  pricing,
  system,
  finance,
  type Order,
  type OrderItem,
  type OrderListFilter,
  type PrintCategoryItem,
} from "@/infrastructure/tauri-bridge";
import {
  PRODUCTION_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  ITEM_KIND_LABELS,
  PRODUCTION_STEP_LABELS,
  productionStatusColor,
  paymentStatusColor,
  deliveryStatusColor,
  productionStepColor,
  nextStepLabel,
  formatMoney,
  formatDate,
  formatDateTime,
} from "@/shared/orderLabels";
import { OrderItemsList } from "@/shared/components/OrderItemsList";
import { AddItemPanel } from "./orders/components/AddItemPanel";
import { PaymentModal } from "./orders/components/PaymentModal";
import { DeliveryModal } from "./orders/components/DeliveryModal";
import { OrderPrintView, ItemPrintView } from "./orders/components/OrderPrintView";

// ── Quick filter logic ──────────────────────────────────────────────

type QuickFilter = "all" | "in_work" | "ready" | "unpaid" | "delivered_unpaid";

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "in_work", label: "В работе" },
  { key: "ready", label: "Готовые" },
  { key: "unpaid", label: "Не оплачены" },
  { key: "delivered_unpaid", label: "Выданы, долг" },
];

function quickFilterToApi(qf: QuickFilter): OrderListFilter {
  switch (qf) {
    case "in_work": return { production_status: "in_work" };
    case "ready": return { production_status: "ready" };
    case "unpaid": return { unpaid_only: true };
    case "delivered_unpaid": return { delivered_but_unpaid: true };
    default: return {};
  }
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded ${color}`}>
      {label}
    </span>
  );
}

// ── Main page component ─────────────────────────────────────────────

export function OrdersPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const selectedId = id === "new" ? null : id ? Number(id) : null;
  const isCreating = id === "new";

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [showCancelled, setShowCancelled] = useState(false);
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<number | "">("");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpanded = (orderId: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(orderId) ? next.delete(orderId) : next.add(orderId);
      return next;
    });

  const { data: clientList } = useTauriCommand(() => clients.list(), []);

  const filter: OrderListFilter = {
    ...(showCancelled ? { production_status: "cancelled" } : quickFilterToApi(quickFilter)),
    ...(clientFilter ? { client_id: clientFilter } : {}),
  };
  const fetchOrders = useCallback(() => orders.list(filter), [quickFilter, showCancelled, clientFilter]);
  const { data: orderList, loading: listLoading, refetch: refetchList } = useTauriCommand(fetchOrders, [quickFilter, showCancelled, clientFilter]);

  const filtered = (orderList ?? []).filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return o.number.toLowerCase().includes(q) || (o.client_name ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="flex gap-0 -m-6 h-[calc(100vh)] overflow-hidden">
      {/* Left: order list */}
      <div className="w-[380px] shrink-0 flex flex-col border-r border-gray-200 bg-gray-50/50">
        <div className="p-4 pb-3 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold">Заказы</h1>
            <div className="flex gap-1.5">
              <button
                className="px-2.5 py-1 border border-gray-200 bg-white text-xs rounded hover:bg-gray-50 transition-colors"
                onClick={async () => {
                  try {
                    const path = await system.exportOrdersCsv();
                    toast.success(`Экспорт: ${path}`, { duration: 5000 });
                  } catch (err) { toast.error(String(err)); }
                }}
              >
                CSV
              </button>
              <button
                className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                onClick={() => navigate("/orders/new")}
              >
                + Заказ
              </button>
            </div>
          </div>
          <div className="flex gap-1 flex-wrap mb-2">
            {QUICK_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setQuickFilter(f.key); setShowCancelled(false); }}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  quickFilter === f.key && !showCancelled
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setShowCancelled((v) => !v)}
              title="Показать только отменённые заказы"
              className={`px-2 py-1 text-xs rounded transition-colors ${
                showCancelled
                  ? "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Отменённые
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-full px-2.5 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/15"
          />
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value ? Number(e.target.value) : "")}
            className={`w-full mt-2 px-2.5 py-1.5 border rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/15 ${
              clientFilter ? "border-blue-400 bg-blue-50/40 text-gray-800" : "border-gray-200 text-gray-600"
            }`}
          >
            <option value="">Все клиенты</option>
            {(clientList ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.phone ? ` (${c.phone})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto">
          {listLoading ? (
            <p className="text-gray-400 text-sm p-4">Загрузка...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-sm p-4 text-center">Нет заказов</p>
          ) : (
            filtered.map((o) => (
              <div
                key={o.id}
                onClick={() => navigate(`/orders/${o.id}`)}
                className={`px-4 py-2.5 border-b border-gray-100 cursor-pointer transition-colors ${
                  selectedId === o.id
                    ? "bg-blue-50 border-l-2 border-l-blue-600"
                    : "hover:bg-white border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-mono text-sm font-medium">{o.number}</span>
                  <span className="text-xs text-gray-400">{formatDate(o.created_at)}</span>
                </div>
                <div className="text-sm text-gray-600 mb-1 truncate">
                  {o.client_name ?? "Без клиента"}
                </div>
                {o.items_count > 0 && (
                  <div className="mb-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleExpanded(o.id); }}
                      title={expanded.has(o.id) ? "Свернуть позиции" : "Показать позиции"}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      {o.items_count} поз. {expanded.has(o.id) ? "▴" : "▾"}
                    </button>
                  </div>
                )}
                {expanded.has(o.id) && (
                  <div className="mb-1.5 pl-2 border-l-2 border-gray-200" onClick={(e) => e.stopPropagation()}>
                    <OrderItemsList orderId={o.id} />
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <StatusBadge
                    label={PRODUCTION_STATUS_LABELS[o.production_status]}
                    color={productionStatusColor(o.production_status)}
                  />
                  {o.debt_amount > 0 && (
                    <span className="text-xs text-red-600 font-mono">
                      долг {formatMoney(o.debt_amount)}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto font-mono">
                    {formatMoney(o.total_amount)} ₸
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: detail or create */}
      <div className="flex-1 overflow-y-auto p-6">
        {isCreating ? (
          <CreateOrderPanel
            onCreated={(newId) => { refetchList(); navigate(`/orders/${newId}`); }}
            onCancel={() => navigate("/orders")}
          />
        ) : selectedId ? (
          <OrderDetail
            orderId={selectedId}
            onOrderChanged={refetchList}
            onOrderDeleted={() => { refetchList(); navigate("/orders"); }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Выберите заказ или создайте новый
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create order panel (compact inline) ─────────────────────────────

function CreateOrderPanel({
  onCreated, onCancel,
}: {
  onCreated: (id: number) => void;
  onCancel: () => void;
}) {
  const { data: clientList } = useTauriCommand(clients.list);
  const { data: programs } = useTauriCommand(pricing.listPrograms);

  const [clientId, setClientId] = useState<number | "">("");
  const [pricingProgramId, setPricingProgramId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (clientId && clientList) {
      const c = clientList.find((cl) => cl.id === clientId);
      if (c?.default_pricing_program_id) setPricingProgramId(c.default_pricing_program_id);
    }
  }, [clientId, clientList]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clientId) { toast.error("Выберите клиента"); return; }
    setSubmitting(true);
    try {
      const order = await orders.create({
        client_id: clientId as number,
        pricing_program_id: pricingProgramId || null,
        notes: notes || null,
        due_date: dueDate || null,
      });
      toast.success(`Заказ ${order.number} создан`);
      onCreated(order.id);
    } catch (err) { toast.error(String(err)); }
    finally { setSubmitting(false); }
  };

  const inp = "w-full px-3 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";

  return (
    <div className="max-w-xl">
      <h2 className="text-lg font-semibold mb-4">Новый заказ</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Клиент *</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")} className={inp}>
              <option value="">— Выберите —</option>
              {(clientList ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` (${c.phone})` : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Прайс</label>
            <select value={pricingProgramId} onChange={(e) => setPricingProgramId(e.target.value ? Number(e.target.value) : "")} className={inp}>
              <option value="">— Не выбрана —</option>
              {(programs ?? []).filter((p) => p.is_active).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Готовность</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Заметки</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Комментарий" className={inp} />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={submitting} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
            {submitting ? "..." : "Создать"}
          </button>
          <button type="button" onClick={onCancel} className="px-4 py-1.5 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Order detail ────────────────────────────────────────────────────

function OrderDetail({
  orderId, onOrderChanged, onOrderDeleted,
}: {
  orderId: number;
  onOrderChanged: () => void;
  onOrderDeleted: () => void;
}) {
  const fetchOrder = useCallback(() => orders.get(orderId), [orderId]);
  const fetchItems = useCallback(() => orderItems.list(orderId), [orderId]);
  const fetchPayments = useCallback(() => orderPayments.list(orderId), [orderId]);
  const fetchDeliveries = useCallback(() => orderPayments.listDeliveries(orderId), [orderId]);

  const { data: order, loading, refetch: refetchOrder } = useTauriCommand(fetchOrder, [orderId]);
  const { data: items, refetch: refetchItems } = useTauriCommand(fetchItems, [orderId]);
  const { data: payments, refetch: refetchPayments } = useTauriCommand(fetchPayments, [orderId]);
  const { data: deliveries, refetch: refetchDeliveries } = useTauriCommand(fetchDeliveries, [orderId]);
  const { data: printCategories } = useTauriCommand(catalogs.printCategories);

  const [itemPanelMode, setItemPanelMode] = useState<"add" | OrderItem | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const [showPrint, setShowPrint] = useState<"receipt" | null>(null);
  const [printItem, setPrintItem] = useState<OrderItem | null>(null);

  const refetchAll = () => {
    refetchOrder();
    refetchItems();
    refetchPayments();
    refetchDeliveries();
    onOrderChanged();
  };

  // Void a payment straight from the order (reuses the journal's void path with
  // the same closed-period / balance-cascade confirmations), so the operator
  // doesn't have to hunt for it in the finance journal.
  const handleVoidPayment = async (financeTxId: number | null) => {
    if (!financeTxId) {
      toast.error("У этой оплаты нет связанной операции — отмените через журнал финансов.");
      return;
    }
    const reason = window.prompt("Причина отмены оплаты:");
    if (!reason || !reason.trim()) return;
    const r = reason.trim();
    const attempt = async (force: boolean, cascade: boolean): Promise<void> => {
      try {
        await finance.voidTransaction(financeTxId, r, force, cascade);
        toast.success("Оплата отменена");
        refetchAll();
      } catch (err) {
        const msg = String(err);
        if (!force && msg.includes("Период") && msg.includes("закрыт")) {
          if (!window.confirm(`${msg}\n\nОткрыть период заново и продолжить?`)) return;
          await attempt(true, cascade);
          return;
        }
        if (!cascade && msg.includes("каскадную отмену")) {
          if (!window.confirm(`${msg}\n\nПродолжить с каскадной отменой? Связанные оплаты с баланса откатятся.`)) return;
          await attempt(force, true);
          return;
        }
        toast.error(msg, { duration: 7000 });
      }
    };
    await attempt(false, false);
  };

  const handleRemoveDelivery = async (deliveryId: number) => {
    if (!window.confirm("Снять отметку выдачи? Делайте это, только если выдачи на самом деле не было.")) return;
    try {
      await orderPayments.deleteDelivery(deliveryId);
      toast.success("Отметка выдачи снята");
      refetchAll();
    } catch (err) {
      toast.error(String(err));
    }
  };

  if (loading || !order) {
    return <p className="text-gray-500">Загрузка...</p>;
  }

  const isDraft = order.production_status === "draft";
  const isCancelled = order.production_status === "cancelled";

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Заказ {order.number}</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {order.client_name ? (
              <Link
                to={`/clients/${order.client_id}`}
                className="text-blue-600 hover:text-blue-700"
              >
                {order.client_name}
              </Link>
            ) : (
              "Без клиента"
            )}
            {" "}&middot; {formatDate(order.created_at)}
            {order.due_date && <span> &middot; Готовность: {formatDate(order.due_date)}</span>}
          </p>
        </div>
        <div className="flex gap-1.5">
          {!isCancelled && (
            <button onClick={() => setShowPrint("receipt")} className="px-2.5 py-1 border border-gray-200 bg-white text-xs rounded hover:bg-gray-50">Квитанция</button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 mb-4">
        <StatusBadge label={PRODUCTION_STATUS_LABELS[order.production_status]} color={productionStatusColor(order.production_status)} />
        <StatusBadge label={PAYMENT_STATUS_LABELS[order.payment_status]} color={paymentStatusColor(order.payment_status)} />
        <StatusBadge label={DELIVERY_STATUS_LABELS[order.delivery_status]} color={deliveryStatusColor(order.delivery_status)} />
      </div>

      {/* Actions */}
      <ActionBar
        order={order}
        onRefresh={refetchAll}
        onAddItem={() => setItemPanelMode("add")}
        onPayment={() => setShowPayment(true)}
        onDelivery={() => setShowDelivery(true)}
        onDeleted={onOrderDeleted}
      />

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        {/* Items */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Позиции</h3>
              {(isDraft || order.production_status === "in_work") && (
                <button onClick={() => setItemPanelMode("add")} className="text-sm text-blue-600 hover:text-blue-700">+ Добавить</button>
              )}
            </div>
            {(items ?? []).length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Нет позиций</p>
            ) : (
              <div className="space-y-2">
                {(items ?? []).map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    isCancelled={isCancelled}
                    showSteps={!isDraft && !isCancelled}
                    printCategories={printCategories ?? []}
                    onEdit={() => setItemPanelMode(item)}
                    onCancel={async () => {
                      if (!confirm(`Удалить позицию "${item.description || ITEM_KIND_LABELS[item.item_kind]}"?`)) return;
                      const doCancel = async (force: boolean) => {
                        await orderItems.cancel(item.id, force);
                        toast.success("Позиция удалена");
                        refetchAll();
                      };
                      try {
                        await doCancel(false);
                      } catch (err) {
                        const msg = String(err);
                        if (msg.includes("Подтвердите отмену")) {
                          if (!confirm(`${msg}\n\nВсё равно отменить позицию?`)) return;
                          try {
                            await doCancel(true);
                          } catch (err2) { toast.error(String(err2)); }
                          return;
                        }
                        toast.error(msg);
                      }
                    }}
                    onRestore={async () => {
                      try {
                        await orderItems.restore(item.id);
                        toast.success("Позиция возвращена");
                        refetchAll();
                      } catch (err) { toast.error(String(err)); }
                    }}
                    onAdvance={async () => {
                      try {
                        await production.advanceStep(item.id);
                        refetchAll();
                      } catch (err) { toast.error(String(err)); }
                    }}
                    onRefresh={refetchAll}
                    onPrint={() => setPrintItem(item)}
                  />
                ))}
              </div>
            )}
          </div>

          {!isCancelled && (
            <FolderPathBlock order={order} onSaved={refetchAll} />
          )}
          {!isCancelled && (
            <NotesBlock order={order} onSaved={refetchAll} />
          )}
          {isCancelled && order.notes && (
            <div className="bg-white border border-gray-200 rounded-md p-4">
              <h3 className="text-base font-semibold mb-2">Заметки</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Right: summary + payments + deliveries */}
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-md p-4">
            <h3 className="text-base font-semibold mb-3">Итого</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Сумма заказа</span>
                <span className="font-mono font-medium">{formatMoney(order.total_amount)} ₸</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Оплачено</span>
                <span className="font-mono">{formatMoney(order.paid_amount)} ₸</span>
              </div>
              {order.debt_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Остаток</span>
                  <span className="font-mono text-red-600 font-medium">{formatMoney(order.debt_amount)} ₸</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Оплаты</h3>
              {!isCancelled && (
                <button onClick={() => setShowPayment(true)} className="text-sm text-blue-600 hover:text-blue-700">+ Оплата</button>
              )}
            </div>
            {!payments || payments.length === 0 ? (
              <p className="text-gray-400 text-sm">Нет оплат</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0 group">
                    <span className="text-gray-600">
                      {formatDateTime(p.paid_at)}
                      <span className="text-gray-400 ml-1.5 text-xs">{PAYMENT_METHOD_LABELS[p.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? p.payment_method}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="font-mono">+{formatMoney(p.amount)} ₸</span>
                      <button
                        onClick={() => handleVoidPayment(p.finance_transaction_id)}
                        title="Отменить эту оплату"
                        className="text-xs text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Отменить
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-md p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold">Выдача</h3>
              {!isCancelled && !isDraft && (
                <button onClick={() => setShowDelivery(true)} className="text-sm text-blue-600 hover:text-blue-700">+ Выдать</button>
              )}
            </div>
            {!deliveries || deliveries.length === 0 ? (
              <p className="text-gray-400 text-sm">Не выдан</p>
            ) : (
              <div className="space-y-1.5 text-sm">
                {deliveries.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0 group">
                    <span>
                      <span className="text-gray-600">{formatDateTime(d.delivered_at)}</span>
                      {d.delivered_by && <span className="text-gray-500 ml-2">({d.delivered_by})</span>}
                    </span>
                    <button
                      onClick={() => handleRemoveDelivery(d.id)}
                      title="Снять отметку выдачи"
                      className="text-xs text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Снять
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {itemPanelMode && (
        <AddItemPanel
          orderId={orderId}
          pricingProgramId={order.pricing_program_id}
          editItem={itemPanelMode === "add" ? undefined : itemPanelMode}
          onClose={() => setItemPanelMode(null)}
          onAdded={refetchAll}
        />
      )}
      {showPayment && (
        <PaymentModal order={order} onClose={() => setShowPayment(false)} onDone={refetchAll} />
      )}
      {showDelivery && (
        <DeliveryModal order={order} onClose={() => setShowDelivery(false)} onDone={refetchAll} />
      )}
      {showPrint && (
        <OrderPrintView order={order} items={items ?? []} payments={payments ?? []} type={showPrint} onClose={() => setShowPrint(null)} />
      )}
      {printItem && (
        <ItemPrintView order={order} item={printItem} onClose={() => setPrintItem(null)} />
      )}
    </div>
  );
}

// ── Folder path block ────────────────────────────────────────────────

function FolderPathBlock({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const pickFolder = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, title: "Выберите папку заказа" });
      if (!selected) return;
      await orders.update(order.id, { notes: order.notes, due_date: order.due_date, folder_path: selected });
      onSaved();
    } catch (err) { toast.error(String(err)); }
  };

  const clearFolder = async () => {
    try {
      await orders.update(order.id, { notes: order.notes, due_date: order.due_date, folder_path: null });
      onSaved();
    } catch (err) { toast.error(String(err)); }
  };

  const openFolder = async () => {
    try { await system.openFolder(order.folder_path!); }
    catch (err) { toast.error(String(err)); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">Папка заказа</h3>
        <div className="flex gap-2">
          <button onClick={pickFolder} className="text-xs text-gray-500 hover:text-blue-600">
            {order.folder_path ? "Изменить" : "Выбрать"}
          </button>
          {order.folder_path && (
            <button onClick={clearFolder} className="text-xs text-red-500 hover:text-red-600">Убрать</button>
          )}
        </div>
      </div>
      {order.folder_path ? (
        <button onClick={openFolder} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 text-left break-all">
          📂 {order.folder_path}
        </button>
      ) : (
        <p className="text-sm text-gray-400 italic">Не указана</p>
      )}
    </div>
  );
}

// ── Notes block ─────────────────────────────────────────────────────

function NotesBlock({ order, onSaved }: { order: Order; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(order.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Sync when order changes
  useEffect(() => { setText(order.notes ?? ""); setEditing(false); }, [order.id, order.notes]);

  const save = async () => {
    setSaving(true);
    try {
      await orders.update(order.id, { notes: text || null, due_date: order.due_date, folder_path: order.folder_path });
      toast.success("Заметки сохранены");
      setEditing(false);
      onSaved();
    } catch (err) { toast.error(String(err)); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-md p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-base font-semibold">Заметки</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="text-xs text-gray-500 hover:text-blue-600">Изм.</button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button onClick={save} disabled={saving} className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? "..." : "Сохранить"}
            </button>
            <button onClick={() => { setText(order.notes ?? ""); setEditing(false); }} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200">
              Отмена
            </button>
          </div>
        </div>
      ) : order.notes ? (
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
      ) : (
        <p className="text-sm text-gray-400 italic">Нет заметок</p>
      )}
    </div>
  );
}

// ── Action bar ──────────────────────────────────────────────────────

function ActionBar({
  order, onRefresh, onAddItem, onPayment, onDelivery, onDeleted,
}: {
  order: Order;
  onRefresh: () => void;
  onAddItem: () => void;
  onPayment: () => void;
  onDelivery: () => void;
  onDeleted: () => void;
}) {
  const isCancelled = order.production_status === "cancelled";
  const isDraft = order.production_status === "draft";
  const nextStatus = getNextProductionStatus(order.production_status);

  const nextLabel = order.production_status === "draft" ? "Начать" :
    (PRODUCTION_STATUS_LABELS[nextStatus as keyof typeof PRODUCTION_STATUS_LABELS] ?? nextStatus);

  const changeStatus = async (status: string) => {
    try {
      if (status === "cancelled") {
        if (!confirm("Отменить заказ?")) return;
        await orders.cancel(order.id);
      } else if (status === "in_work" && order.production_status === "draft") {
        await orders.confirm(order.id);
      } else {
        await orders.updateProductionStatus(order.id, status);
      }
      toast.success(`Статус: ${PRODUCTION_STATUS_LABELS[status as keyof typeof PRODUCTION_STATUS_LABELS] ?? status}`);
      onRefresh();
    } catch (err) { toast.error(String(err)); }
  };

  const handleDelete = async () => {
    if (!confirm(`Удалить заказ ${order.number} полностью? Это действие необратимо.`)) return;
    try {
      await orders.delete(order.id);
      toast.success("Заказ удалён");
      onDeleted();
    } catch (err) {
      toast.error(String(err), { duration: 7000 });
    }
  };

  const canAddItems = ["draft", "in_work"].includes(order.production_status);
  // Drafts, cancelled orders, and empty orders (no active items) can be deleted.
  // The backend still blocks anything with a financial trace.
  const canDelete = isDraft || isCancelled || order.items_count === 0;

  return (
    <div className="flex flex-wrap gap-2">
      {canAddItems && (
        <button onClick={onAddItem} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors">+ Позиция</button>
      )}
      {nextStatus && !isCancelled && (
        <button onClick={() => changeStatus(nextStatus)} className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors">
          {nextLabel}
        </button>
      )}
      {!isCancelled && (
        <button onClick={onPayment} className="px-3 py-1.5 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">Оплата</button>
      )}
      {!["draft", "cancelled"].includes(order.production_status) && (
        <button onClick={onDelivery} className="px-3 py-1.5 border border-gray-200 bg-white text-sm rounded-md hover:bg-gray-50 transition-colors">Выдать</button>
      )}
      {["draft", "in_work"].includes(order.production_status) && (
        <button onClick={() => changeStatus("cancelled")} className="px-3 py-1.5 text-red-600 border border-red-200 bg-white text-sm rounded-md hover:bg-red-50 transition-colors">Отменить</button>
      )}
      {canDelete && (
        <button
          onClick={handleDelete}
          title="Полное удаление. Доступно для черновиков, отменённых и пустых заказов без оплат и активности."
          className="px-3 py-1.5 text-red-700 border border-red-300 bg-white text-sm rounded-md hover:bg-red-50 transition-colors"
        >
          Удалить
        </button>
      )}
    </div>
  );
}

function getNextProductionStatus(current: string): string | null {
  switch (current) {
    case "draft": return "in_work";
    case "confirmed": return "in_work"; // legacy
    case "in_work": return "ready";
    case "ready": return "closed";
    default: return null;
  }
}

// ── Item row ────────────────────────────────────────────────────────

function ItemRow({
  item, isCancelled: orderCancelled, showSteps, printCategories, onEdit, onCancel, onRestore, onAdvance, onRefresh, onPrint,
}: {
  item: OrderItem;
  isCancelled: boolean;
  showSteps: boolean;
  printCategories: PrintCategoryItem[];
  onEdit: () => void;
  onCancel: () => void;
  onRestore: () => void;
  onAdvance: () => void;
  onRefresh: () => void;
  onPrint: () => void;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(item.note ?? "");

  const saveNote = async () => {
    try {
      await orderItems.updateNote(item.id, noteText.trim() || null);
      setEditingNote(false);
      onRefresh();
    } catch (err) { toast.error(String(err)); }
  };

  // Resolve print category flags from spec_snapshot_json
  const flags = (() => {
    if (item.item_kind !== "print") return undefined;
    try {
      const spec = JSON.parse(item.spec_snapshot_json);
      const cat = printCategories.find((c) => c.code === spec.category);
      if (cat) return { has_printing: cat.has_printing, has_assembly: cat.has_assembly };
    } catch { /* ignore */ }
    return undefined;
  })();
  const next = nextStepLabel(item.item_kind, item.production_step, flags);

  return (
    <div className={`py-2 px-3 rounded border ${
      item.is_cancelled ? "border-gray-100 bg-gray-50 opacity-60 line-through" : "border-gray-100"
    }`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
              {ITEM_KIND_LABELS[item.item_kind]}
            </span>
            {showSteps && !item.is_cancelled && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${productionStepColor(item.production_step)}`}>
                {PRODUCTION_STEP_LABELS[item.production_step]}
              </span>
            )}
            {item.price_source === "manual" && (
              <span className="text-xs px-1.5 py-0.5 bg-yellow-100 rounded text-yellow-700">Ручная цена</span>
            )}
          </div>
          <p className="text-sm mt-1">{item.description || "—"}</p>
        </div>
        <div className="text-right ml-4 shrink-0">
          <div className="text-sm font-mono">
            {item.qty} x {formatMoney(item.unit_price)} = <span className="font-medium">{formatMoney(item.total_price)} ₸</span>
          </div>
          <div className="flex items-center justify-end gap-2 mt-1">
            {showSteps && !item.is_cancelled && next && (
              <button onClick={(e) => { e.stopPropagation(); onAdvance(); }}
                className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700">{next}</button>
            )}
            {!item.is_cancelled && (
              <button onClick={(e) => { e.stopPropagation(); onPrint(); }}
                className="text-xs px-2 py-0.5 border border-gray-300 rounded text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">Наряд</button>
            )}
            {!item.is_cancelled && !orderCancelled && (
              <>
                <button onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="text-xs text-gray-500 hover:text-blue-600">Изм.</button>
                <button onClick={(e) => { e.stopPropagation(); onCancel(); }}
                  className="text-xs text-red-500 hover:text-red-600">Удл.</button>
              </>
            )}
            {item.is_cancelled && !orderCancelled && (
              <button onClick={(e) => { e.stopPropagation(); onRestore(); }}
                className="text-xs px-2 py-0.5 border border-gray-300 rounded text-gray-600 hover:border-green-500 hover:text-green-600 transition-colors no-underline">Вернуть</button>
            )}
          </div>
        </div>
      </div>
      {/* Inline note */}
      {!item.is_cancelled && (
        editingNote ? (
          <div className="flex gap-1.5 mt-1.5">
            <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder="Комментарий..."
              className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") { setEditingNote(false); setNoteText(item.note ?? ""); } }}
              autoFocus />
            <button onClick={saveNote} className="text-xs text-blue-600 hover:text-blue-700">OK</button>
            <button onClick={() => { setEditingNote(false); setNoteText(item.note ?? ""); }} className="text-xs text-gray-400">Отм.</button>
          </div>
        ) : item.note ? (
          <p className="text-xs text-gray-800 mt-1.5 cursor-pointer bg-gray-100 border-l-2 border-gray-400 px-2 py-1 rounded-r hover:bg-gray-200 whitespace-pre-wrap"
            onClick={(e) => { e.stopPropagation(); setEditingNote(true); }}>
            {item.note}
          </p>
        ) : (
          <p className="text-xs text-gray-400 mt-1 cursor-pointer hover:text-gray-600"
            onClick={(e) => { e.stopPropagation(); setEditingNote(true); }}>
            + комментарий
          </p>
        )
      )}
    </div>
  );
}

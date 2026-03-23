import type {
  ProductionStatus,
  PaymentStatus,
  DeliveryStatus,
  ItemKind,
  ProductionStep,
} from "@/infrastructure/tauri-bridge";

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  draft: "Черновик",
  confirmed: "В работе",
  in_work: "В работе",
  ready: "Готов",
  closed: "Закрыт",
  cancelled: "Отменён",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Не оплачен",
  partial: "Частично",
  paid: "Оплачен",
  overpaid: "Переплата",
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  not_delivered: "Не выдан",
  partially_delivered: "Частично выдан",
  delivered: "Выдан",
};

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  book: "Книга",
  print: "Печать",
  service: "Услуга",
  extra: "Доп. опция",
};

export const PRODUCTION_STEP_LABELS: Record<ProductionStep, string> = {
  pending: "Ожидает",
  printed: "Напечатано",
  assembled: "Собрано",
  done: "Готово",
};

export function productionStepColor(s: ProductionStep): string {
  switch (s) {
    case "pending": return "bg-gray-100 text-gray-600";
    case "printed": return "bg-blue-100 text-blue-700";
    case "assembled": return "bg-yellow-100 text-yellow-800";
    case "done": return "bg-green-100 text-green-700";
  }
}

export function stepsForFlags(hasPrinting: boolean, hasAssembly: boolean): ProductionStep[] {
  if (hasPrinting && hasAssembly) return ["pending", "printed", "assembled", "done"];
  if (hasPrinting) return ["pending", "printed", "done"];
  if (hasAssembly) return ["pending", "assembled", "done"];
  return ["pending", "done"];
}

export function nextStepLabel(
  kind: ItemKind,
  current: ProductionStep,
  flags?: { has_printing: boolean; has_assembly: boolean },
): string | null {
  let steps: ProductionStep[];
  if (kind === "book") {
    steps = stepsForFlags(true, true);
  } else if (kind === "print" && flags) {
    steps = stepsForFlags(flags.has_printing, flags.has_assembly);
  } else if (kind === "print") {
    steps = stepsForFlags(true, false);
  } else {
    steps = stepsForFlags(false, false);
  }

  const idx = steps.indexOf(current);
  if (idx < 0 || idx >= steps.length - 1) return null;
  // The penultimate step auto-advances to "done", so button shows that step name
  const nextStep = steps[idx + 1];
  if (nextStep === "done") return null; // auto-done, no button needed
  return PRODUCTION_STEP_LABELS[nextStep];
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  bank_transfer: "Перевод",
};

export function productionStatusColor(s: ProductionStatus): string {
  switch (s) {
    case "draft":
      return "bg-gray-100 text-gray-700";
    case "confirmed":
    case "in_work":
      return "bg-yellow-100 text-yellow-800";
    case "ready":
      return "bg-green-100 text-green-700";
    case "closed":
      return "bg-gray-200 text-gray-600";
    case "cancelled":
      return "bg-red-100 text-red-700";
  }
}

export function paymentStatusColor(s: PaymentStatus): string {
  switch (s) {
    case "unpaid":
      return "bg-red-100 text-red-700";
    case "partial":
      return "bg-yellow-100 text-yellow-800";
    case "paid":
      return "bg-green-100 text-green-700";
    case "overpaid":
      return "bg-purple-100 text-purple-700";
  }
}

export function deliveryStatusColor(s: DeliveryStatus): string {
  switch (s) {
    case "not_delivered":
      return "bg-gray-100 text-gray-600";
    case "partially_delivered":
      return "bg-yellow-100 text-yellow-800";
    case "delivered":
      return "bg-green-100 text-green-700";
  }
}

export const CURRENCY_SYMBOL = "₸";

export function formatMoney(amount: number): string {
  return amount.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatMoneyWithCurrency(amount: number): string {
  return `${formatMoney(amount)} ${CURRENCY_SYMBOL}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU");
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Finance labels ──────────────────────────────────────────────────

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  order_payment_in: "Оплата заказа",
  order_refund_out: "Возврат клиенту",
  other_income_in: "Прочий доход",
  company_expense_out: "Расход компании",
  transfer_between_accounts: "Перевод между счетами",
  supplier_debt_opened: "Открытие долга",
  supplier_debt_paid: "Оплата долга",
  partner_paid_company_expense: "Партнёр оплатил расход",
  company_reimbursed_partner: "Возмещение партнёру",
  partner_profit_payout: "Выплата прибыли",
  partner_draw: "Draw (аванс)",
  adjustment: "Корректировка",
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  cash: "Касса",
  card: "Карта",
  bank: "Банк",
};

export const SETTLEMENT_TYPE_LABELS: Record<string, string> = {
  contribution: "Вклад в бизнес",
  reimbursement: "Возврат вложений",
  profit_accrual: "Начисление прибыли",
  profit_payout: "Выплата прибыли",
  draw: "Draw (аванс)",
  adjustment: "Корректировка",
};

export const SETTLEMENT_TYPE_HINTS: Record<string, string> = {
  contribution: "Партнёр внёс деньги в бизнес из личных средств",
  reimbursement: "Компания вернула партнёру ранее вложенные средства",
  profit_accrual: "Доля прибыли, начисленная за период (ещё не выплачена)",
  profit_payout: "Фактическая выплата начисленной прибыли партнёру",
  draw: "Партнёр забирает деньги авансом, до распределения прибыли",
  adjustment: "Ручная корректировка расчётов",
};

export function transactionDirectionLabel(dir: string): string {
  switch (dir) {
    case "in": return "Приход";
    case "out": return "Расход";
    default: return "—";
  }
}

export function transactionDirectionColor(dir: string): string {
  switch (dir) {
    case "in": return "text-green-600";
    case "out": return "text-red-600";
    default: return "text-gray-400";
  }
}

export function liabilityStatusLabel(s: string): string {
  switch (s) {
    case "open": return "Открыт";
    case "paid": return "Оплачен";
    case "cancelled": return "Отменён";
    default: return s;
  }
}

export function liabilityStatusColor(s: string): string {
  switch (s) {
    case "open": return "bg-yellow-100 text-yellow-800";
    case "paid": return "bg-green-100 text-green-700";
    case "cancelled": return "bg-gray-100 text-gray-600";
    default: return "bg-gray-100 text-gray-600";
  }
}

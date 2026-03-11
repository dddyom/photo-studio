# Finance Application Layer

Backend слой финансового модуля. Все команды в `src-tauri/src/commands/finance.rs`.

## Tauri Commands

### Company Accounts

| Command | Input | Output | Описание |
|---------|-------|--------|----------|
| `list_accounts` | — | `Vec<CompanyAccount>` | Все счета (вкл. архивные) |
| `create_account` | `{name, account_type}` | `CompanyAccount` | Создание нового счёта |
| `update_account` | `{id, name, account_type}` | `CompanyAccount` | Переименование / смена типа |
| `archive_account` | `id` | `()` | Архивирование (только при нулевом балансе) |

### Finance Transactions

| Command | Input | Output | Описание |
|---------|-------|--------|----------|
| `register_other_income` | `{amount, account_id, finance_category_id?, description?, transaction_date?}` | `FinanceTransaction` | Прочий доход |
| `register_company_expense` | `{amount, account_id, finance_category_id?, description?, transaction_date?}` | `FinanceTransaction` | Расход компании |
| `transfer_between_accounts` | `{amount, from_account_id, to_account_id, description?, transaction_date?}` | `FinanceTransaction` | Перевод между счетами (создаёт 2 связанные записи) |
| `link_transaction_to_order` | `{transaction_id, order_id}` | `()` | Привязка транзакции к заказу |
| `list_transactions` | `{transaction_type?, account_id?, date_from?, date_to?, order_id?}` | `Vec<FinanceTransaction>` | Список с фильтрами |

### Liabilities (долги)

| Command | Input | Output | Описание |
|---------|-------|--------|----------|
| `open_liability` | `{liability_type, counterparty_name, original_amount, description?, opened_at?, due_date?}` | `Liability` | Открытие долга + транзакция `supplier_debt_opened` |
| `pay_liability` | `{liability_id, amount, account_id, description?, transaction_date?}` | `Liability` | Оплата долга (частичная или полная), автостатус `paid` при полной |
| `list_liabilities` | `status?` | `Vec<Liability>` | Список долгов с фильтром по статусу |

### Partner Settlements

| Command | Input | Output | Описание |
|---------|-------|--------|----------|
| `register_partner_contribution` | `{partner_id, amount, account_id, description?, transaction_date?}` | `PartnerSettlementEntry` | Вклад партнёра (деньги → на счёт компании) |
| `register_partner_expense` | `{partner_id, amount, finance_category_id?, description?, transaction_date?}` | `PartnerSettlementEntry` | Партнёр оплатил расход из личных (без движения по счетам) |
| `reimburse_partner` | `{partner_id, amount, account_id, description?, transaction_date?}` | `PartnerSettlementEntry` | Возмещение партнёру (out со счёта) |
| `register_partner_draw` | `{partner_id, amount, account_id, description?, transaction_date?}` | `PartnerSettlementEntry` | Draw — авансовое изъятие |
| `register_partner_profit_payout` | `{partner_id, amount, account_id, description?, transaction_date?}` | `PartnerSettlementEntry` | Выплата начисленной прибыли |
| `list_partner_settlements` | `partner_id?` | `Vec<PartnerSettlementEntry>` | Список записей по партнёру |

### Closing Period

| Command | Input | Output | Описание |
|---------|-------|--------|----------|
| `close_period` | `{period: "YYYY-MM", force?}` | `ClosingPeriod` | Расчёт прибыли + начисление 50/50 |
| `list_closing_periods` | — | `Vec<ClosingPeriod>` | Список закрытых периодов |

### Derived Calculations

| Command | Input | Output | Описание |
|---------|-------|--------|----------|
| `get_finance_summary` | — | `FinanceSummary` | Сводка: балансы счетов, долги, партнёрские итоги |

## Derived Calculations (FinanceSummary)

- **account_balances** — баланс каждого активного счёта
- **total_balance** — сумма всех балансов
- **supplier_debt_outstanding** — сумма непогашенных долгов
- **partner_summaries** — по каждому партнёру:
  - contributions, reimbursements, profit_accrued, profit_paid, draws, adjustments
  - **balance** = contributions + profit_accrued − profit_paid − draws − reimbursements + adjustments

## Расчёт прибыли (cash basis)

```
Income  = Σ order_payment_in + Σ other_income_in
Expense = Σ company_expense_out + Σ supplier_debt_paid + Σ order_refund_out
Profit  = Income − Expense
```

Не входят: transfers, partner settlements, adjustments, supplier_debt_opened.

## Защита от двойного закрытия

- При повторном `close_period` с тем же периодом — ошибка
- С `force: true` — удаляет старые `profit_accrual` записи и пересчитывает

## Интеграция с модулем заказов

- `order_payment_in` / `order_refund_out` транзакции создаются в `order_payments.rs`
- Finance module **не дублирует** эту логику, а **читает** эти записи в queries
- `link_transaction_to_order` позволяет связать произвольную транзакцию с заказом

## Валидация

- Суммы > 0
- Счёт должен быть активным
- Партнёр должен существовать
- Тип обязательства: `supplier_debt` / `other`
- Тип счёта: `cash` / `card` / `bank`
- Формат периода: `YYYY-MM`
- Нельзя оплатить больше остатка долга
- Нельзя архивировать счёт с ненулевым балансом

## Файлы

- `src-tauri/src/commands/finance.rs` — все команды и бизнес-логика
- `src-tauri/tests/finance_integration.rs` — 16 интеграционных тестов

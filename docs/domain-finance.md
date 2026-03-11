# Domain: Finance

## Core principle

Все балансы **вычисляются** из журнала транзакций. Прямое редактирование баланса невозможно. Для коррекции используется тип `adjustment`.

## Entities

### CompanyAccount
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | e.g. "Касса", "Карта Сбер", "Расчётный счёт" |
| account_type | TEXT | cash / card / bank |
| balance | DECIMAL | **computed** — сумма транзакций по этому счёту |
| is_active | BOOLEAN | |

`balance` хранится как кэш для быстрого отображения и пересчитывается при каждой транзакции.

### FinanceTransaction
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| transaction_type | TEXT | см. список ниже |
| amount | DECIMAL | всегда положительное число |
| direction | TEXT | in / out |
| account_id | FK → CompanyAccount | основной счёт |
| counter_account_id | FK → CompanyAccount | NULL, для transfer — второй счёт |
| order_id | FK → Order | NULL, если не связано с заказом |
| liability_id | FK → Liability | NULL, если не связано с долгом |
| partner_id | FK → Partner | NULL, если не связано с партнёром |
| description | TEXT | |
| transaction_date | DATE | |
| created_at | DATETIME | |

### Transaction types

| Type | Direction | Description |
|------|-----------|-------------|
| order_payment_in | in | Оплата заказа клиентом |
| order_refund_out | out | Возврат денег клиенту (полный или частичный) |
| other_income_in | in | Прочий доход (не от заказов) |
| company_expense_out | out | Расход компании (аренда, материалы и т.д.) |
| transfer_between_accounts | in+out | Перевод между своими счетами |
| supplier_debt_opened | — | Открытие долга поставщику (без движения денег) |
| supplier_debt_paid | out | Оплата долга поставщику |
| partner_paid_company_expense | — | Партнёр оплатил расход из личных средств |
| company_reimbursed_partner | out | Компания возместила партнёру |
| partner_profit_payout | out | Выплата доли прибыли партнёру |
| partner_draw | out | Draw — партнёр берёт деньги авансом |
| adjustment | in/out | Ручная корректировка |

### Правила для `transfer_between_accounts`
Создаются **две** записи: одна `out` с account_id = источник, одна `in` с account_id = назначение. Обе имеют общий `transfer_group_id` (или ссылаются друг на друга через `linked_transaction_id`).

**Assumption:** используем `linked_transaction_id` (FK → FinanceTransaction, nullable) для связи парных транзакций.

### Liability (долги)
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| liability_type | TEXT | supplier_debt / other |
| counterparty_name | TEXT | имя поставщика или контрагента |
| description | TEXT | |
| original_amount | DECIMAL | исходная сумма долга |
| paid_amount | DECIMAL | **computed** — сумма оплат |
| status | TEXT | open / paid / cancelled |
| opened_at | DATE | |
| due_date | DATE | NULL if no deadline |
| created_at | DATETIME | |

### Partner
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| profit_share | DECIMAL | 0.50 для каждого из двух партнёров |

В MVP ровно 2 записи, seed при инициализации.

### PartnerSettlement
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| partner_id | FK → Partner | |
| entry_type | TEXT | см. ниже |
| amount | DECIMAL | |
| finance_transaction_id | FK → FinanceTransaction | NULL для profit_accrual |
| description | TEXT | |
| period | TEXT | e.g. "2026-01" (для profit_accrual) |
| created_at | DATETIME | |

### Partner settlement entry types

| Type | Description |
|------|-------------|
| contribution | Партнёр внёс деньги в бизнес |
| reimbursement | Компания возместила партнёру расход |
| profit_accrual | Начисление доли прибыли за период |
| profit_payout | Фактическая выплата прибыли |
| draw | Авансовое изъятие (до распределения прибыли) |
| adjustment | Ручная корректировка |

## Расчёт прибыли (cash basis)

Прибыль за период = Σ income_in − Σ expense_out (по транзакциям за период).

Income: `order_payment_in` + `other_income_in`.
Expenses: `company_expense_out` + `supplier_debt_paid` + `order_refund_out`.

**Не входят** в расчёт: transfers, partner settlements, adjustments.

При закрытии периода:
1. Считается прибыль.
2. Создаётся по одной записи `profit_accrual` на каждого партнёра (amount = прибыль × profit_share).
3. Фактическая выплата — отдельная операция (`profit_payout`).

## Баланс партнёра

`partner_balance = Σ contributions + Σ profit_accruals − Σ profit_payouts − Σ draws − Σ reimbursements ± adjustments`

Положительный баланс = компания должна партнёру. Отрицательный = партнёр должен компании (перебор draw).

## Resolved decisions

1. **Период для закрытия** — календарный месяц.
2. **`partner_paid_company_expense`** — создаёт FinanceTransaction (без движения по счетам компании) + PartnerSettlement `contribution` на ту же сумму. При возмещении — `company_reimbursed_partner` (out со счёта) + PartnerSettlement `reimbursement`.
3. **Налоги** — не учитываются в MVP.
4. **`order_refund_out`** — отдельный тип транзакции для возвратов. `adjustment` используется только для исправления ошибок учёта, не для стандартных возвратов.

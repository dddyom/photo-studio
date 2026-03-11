# Domain: Orders

## Entities

### Client
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | |
| phone | TEXT | |
| email | TEXT | |
| default_pricing_program_id | FK → PricingProgram | может быть NULL |
| notes | TEXT | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

### PricingProgram
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| name | TEXT NOT NULL | e.g. "Цены" |
| is_active | BOOLEAN | |

### PricingRule
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| pricing_program_id | FK | |
| item_type | TEXT | book / print / service / extra |
| parameters | JSON | условия применения (format, material и т.д.) |
| price_formula | JSON | как считать цену (см. ниже) |
| is_active | BOOLEAN | |

**Price formula** — JSON-описание расчёта. Конкретная структура определяется при реализации. Минимальный вариант: фиксированная цена или base + per_unit * quantity.

### Order
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| number | TEXT UNIQUE | человекочитаемый номер |
| client_id | FK → Client | |
| pricing_program_id | FK | программа, действовавшая при создании заказа |
| production_status | TEXT | draft / confirmed / in_work / ready / closed / cancelled |
| payment_status | TEXT | unpaid / partial / paid / overpaid |
| delivery_status | TEXT | not_delivered / partially_delivered / delivered |
| total_amount | DECIMAL | сумма всех позиций |
| paid_amount | DECIMAL | сумма всех payments |
| notes | TEXT | |
| created_at | DATETIME | |
| updated_at | DATETIME | |

**Бизнес-правила статусов:**
- production_status, payment_status, delivery_status — **независимые** друг от друга.
- payment_status **вычисляется** из paid_amount vs total_amount (не ставится вручную).
- Выдача (delivery_status = delivered) разрешена при любом payment_status.
- Отмена заказа (cancelled) не создаёт автоматический возврат денег. Возврат — отдельное действие оператора.
- Возврат может быть полным или частичным (создаёт FinanceTransaction типа `order_refund_out`).

### OrderItem
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| order_id | FK → Order | |
| item_type | TEXT | book / print / service / extra |
| description | TEXT | человекочитаемое описание |
| quantity | INTEGER | |
| unit_price | DECIMAL | цена за единицу (авто или ручная) |
| total_price | DECIMAL | quantity * unit_price |
| price_source | TEXT | auto / manual |
| manual_price_reason | TEXT | NULL если price_source = auto; причина ручной цены |
| parameters_snapshot | JSON | все параметры, по которым считалась цена |
| price_breakdown | JSON | детализация расчёта цены |

### OrderItem parameters by type

**book:**
- format (e.g. "20x30", "30x40")
- spread_count (количество разворотов)
- assembly_kind (plastic / pvc_board) — тип сборки блока
- cover_family (laminated_hard / eco_leather / ...) — семейство обложки
- cover_options (list of strings: engraving, photo_insert, corners, ...) — опции обложки
- block_material
- cover_type (hard / soft)
- cover_material
- lamination (matte / glossy / none)
- extras (list of optional extras)

При указании `assembly_kind` используется составной расчёт цены (book_composite): блок × кол-во разворотов + обложка + Σ опций обложки.

**print:**
- category (lab_print / wide_format_print / wide_format_lamination / photo_lamination / photo_magnet / photo_pvc / dsp_picture / canvas_stretched / calendar_double_sided)
- format (e.g. "10x15", "15x21", "20x30")
- material (glossy paper, matte paper, canvas, etc.) — для wide_format_print
- finishing (lamination, framing, etc.)

**service:**
- service_name
- description

**extra:**
- extra_name
- description

### Payment
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| order_id | FK → Order | |
| amount | DECIMAL | |
| payment_method | TEXT | cash / card / bank_transfer |
| account_id | FK → CompanyAccount | куда поступили деньги |
| finance_transaction_id | FK → FinanceTransaction | связанная проводка |
| notes | TEXT | |
| paid_at | DATETIME | |
| created_at | DATETIME | |

При создании Payment:
1. Обновляется order.paid_amount.
2. Пересчитывается order.payment_status.
3. Автоматически создаётся FinanceTransaction типа `order_payment_in`.

### Refund
| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER PK | |
| order_id | FK → Order | |
| amount | DECIMAL | сумма возврата |
| payment_method | TEXT | cash / card / bank_transfer |
| account_id | FK → CompanyAccount | откуда возвращаются деньги |
| finance_transaction_id | FK → FinanceTransaction | связанная проводка (order_refund_out) |
| reason | TEXT | причина возврата |
| refunded_at | DATETIME | |
| created_at | DATETIME | |

При создании Refund:
1. Обновляется order.paid_amount (уменьшается).
2. Пересчитывается order.payment_status.
3. Автоматически создаётся FinanceTransaction типа `order_refund_out`.

## Нумерация заказов

Формат: `YYММ-NNN` (например, `2601-042`). Номер автоинкрементный в пределах месяца.

**Assumption:** формат нумерации можно уточнить с пользователем; это стартовый вариант.

## Правила редактирования позиций

- **draft**: позиции можно добавлять, редактировать и удалять свободно.
- **confirmed и далее**: физическое удаление позиции запрещено. Доступны:
  - Редактирование параметров позиции (пересчёт цены).
  - Отмена отдельной позиции (мягкое удаление / статус cancelled на позиции — если потребуется, добавить поле `is_cancelled`).
  - Отмена всего заказа.

## Ценообразование

- Базовая цена рассчитывается автоматически по PricingRule.
- Оператор может вручную переопределить unit_price на уровне позиции.
- При ручном переопределении: `price_source = "manual"`, обязательно заполняется `manual_price_reason`.
- В MVP нет rule-based системы скидок. Скидка = ручное изменение цены с указанием причины.
- Опционально: ручная скидка на весь заказ (реализуется как добавление позиции типа `extra` с отрицательной суммой или как отдельное поле `order_discount` — решение при реализации).

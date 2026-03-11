# Roadmap

## Phase 1: Foundation
- Инициализация проекта (Tauri 2 + React + Vite + TypeScript)
- Настройка SQLite (tauri-plugin-sql или custom Rust commands)
- Миграции БД (schema creation)
- Базовый layout приложения (sidebar navigation, основные страницы)

## Phase 2: Справочники
- CRUD клиентов
- Справочники материалов (форматы, материалы, ламинации, отделки)
- Pricing programs + pricing rules

## Phase 3: Заказы (core)
- Создание заказа с позициями (book, print, service, extra)
- Расчёт цены по pricing rules + snapshot
- Список заказов с фильтрами (по статусам, клиенту, дате)
- Карточка заказа (просмотр, редактирование)
- Смена production_status и delivery_status

## Phase 4: Оплаты
- Приём оплаты (с выбором счёта)
- Частичная оплата
- Автоматическое обновление payment_status
- Автоматическое создание finance transaction

## Phase 5: Печать
- Шаблон квитанции
- Шаблон производственного листа
- Печать через системный диалог

## Phase 6: Финансы (core)
- Company accounts (cash, card, bank)
- Ручное создание finance transactions (расходы, прочие доходы, transfers)
- Сводка по счетам

## Phase 7: Долги и партнёры
- Liabilities (supplier debts)
- Partner settlement entries
- Расчёт прибыли за период (cash basis)
- Закрытие периода (profit_accrual)
- Выплата прибыли (profit_payout)
- Draw

## Phase 8: Polish
- Поиск и фильтры по всем спискам
- Настройки (название компании, логотип для квитанции)
- Валидации и edge cases
- Backup / export БД

---

Фазы не жёсткие — можно совмещать. Основной принцип: каждая фаза даёт работающую функциональность, которую можно показать и использовать.

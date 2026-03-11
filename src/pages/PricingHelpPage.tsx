import { useNavigate } from "react-router-dom";

export function PricingHelpPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <button
          onClick={() => navigate("/pricing")}
          className="text-gray-400 hover:text-gray-600 text-sm mb-2"
        >
          &larr; Назад к прайсам
        </button>
        <h1 className="text-2xl font-semibold">Как работает ценообразование</h1>
        <p className="text-gray-500 mt-1">
          Простое объяснение связи справочников, прайсов и заказов
        </p>
      </div>

      <div className="space-y-6">
        {/* Overview */}
        <Section title="Общая схема">
          <p>
            Цена позиции в заказе рассчитывается автоматически по цепочке:
          </p>
          <div className="my-3 p-4 bg-blue-50 border border-blue-200 rounded-md text-sm font-medium text-blue-900 text-center">
            Справочники (что продаём)
            <span className="mx-2 text-blue-400">&rarr;</span>
            Прайс-программа (по какой цене)
            <span className="mx-2 text-blue-400">&rarr;</span>
            Правила (формула расчёта)
            <span className="mx-2 text-blue-400">&rarr;</span>
            Цена в заказе
          </div>
        </Section>

        {/* Catalogs */}
        <Section title="1. Справочники — что мы продаём">
          <p>
            Справочники описывают <strong>номенклатуру</strong> — все варианты
            продуктов и материалов:
          </p>
          <ul className="list-disc ml-5 mt-2 space-y-1">
            <li>
              <strong>Форматы книг</strong> — размеры фотокниг (20x20, 20x30, 30x40...)
            </li>
            <li>
              <strong>Форматы печати</strong> — размеры фотографий (10x15, 13x18, 20x30...)
            </li>
            <li>
              <strong>Материалы</strong> — бумага для блока (глянцевая, матовая), для печати, отделка (ламинация, рамка)
            </li>
            <li>
              <strong>Обложки</strong> — тип (твёрдая, мягкая) и материал (кожзам, ткань, фотообложка)
            </li>
            <li>
              <strong>Ламинация</strong> — глянцевая, матовая, без ламинации
            </li>
            <li>
              <strong>Доп. опции</strong> — подарочная коробка, гравировка, цветной форзац и т.д. У каждой может быть цена по умолчанию
            </li>
          </ul>
          <Hint>
            Справочники не содержат цен (кроме доп. опций). Цены задаются в прайс-программах.
          </Hint>
        </Section>

        {/* Pricing programs */}
        <Section title="2. Прайс-программы — наборы цен">
          <p>
            Прайс-программа — это <strong>набор правил расчёта</strong>. У каждого клиента
            может быть своя программа (например, «Стандарт» или «Оптовый»).
          </p>
          <p className="mt-2">
            Когда клиент назначен на программу «Стандарт», все его заказы
            считаются по правилам этой программы.
          </p>
          <Hint>
            Можно создать несколько программ с разными ценами для разных
            категорий клиентов.
          </Hint>
        </Section>

        {/* Rules */}
        <Section title="3. Правила — формулы расчёта">
          <p>Каждое правило определяет:</p>
          <ol className="list-decimal ml-5 mt-2 space-y-2">
            <li>
              <strong>Тип позиции</strong> — к каким позициям применяется:
              <ul className="list-disc ml-5 mt-1 space-y-0.5 text-gray-600">
                <li><strong>Фотокнига</strong> — альбомы с разворотами</li>
                <li><strong>Печать</strong> — печать отдельных фотографий</li>
                <li><strong>Услуга</strong> — ретушь, дизайн (всегда ручная цена, правила не нужны)</li>
                <li><strong>Доп. опция</strong> — коробки, гравировка (берёт цену из справочника или ручную)</li>
              </ul>
            </li>
            <li>
              <strong>Параметры совпадения</strong> — фильтр по характеристикам
              позиции. Например:
              <div className="mt-1 space-y-1">
                <CodeExample
                  code='{}'
                  desc="правило для всех фотокниг / всей печати"
                />
                <CodeExample
                  code='{"format":"20x30"}'
                  desc="только для формата 20x30"
                />
                <CodeExample
                  code='{"format":"20x30","cover_type":"Твёрдая"}'
                  desc="только 20x30 с твёрдой обложкой"
                />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Если подходят несколько правил — побеждает самое точное (с
                наибольшим числом совпавших параметров).
              </p>
            </li>
            <li>
              <strong>Формула</strong> — как считать цену:
              <div className="mt-2 space-y-3">
                <FormulaCard
                  name="Фиксированная цена"
                  formula="Цена = price × количество"
                  example="Печать 10x15: price = 50 ₸. Заказ 100 фото → 50 × 100 = 5 000 ₸"
                />
                <FormulaCard
                  name="База + за единицу"
                  formula="Цена = (base + per_unit × кол-во единиц) × количество"
                  example="Фотокнига: base = 2 000, per_unit = 200, unit_field = spread_count.
При 15 разворотах: (2 000 + 200 × 15) = 5 000 ₸/шт.
Заказ 25 экз. → 5 000 × 25 = 125 000 ₸"
                />
              </div>
            </li>
          </ol>
        </Section>

        {/* Order flow */}
        <Section title="4. Что происходит при создании заказа">
          <ol className="list-decimal ml-5 space-y-2">
            <li>
              Оператор выбирает клиента. Подтягивается его прайс-программа.
            </li>
            <li>
              Оператор добавляет позицию (например, фотокнигу 20x30, 15
              разворотов, 25 экз.).
            </li>
            <li>
              Система ищет подходящее правило в программе клиента по типу позиции
              и параметрам совпадения.
            </li>
            <li>Применяет формулу и рассчитывает цену.</li>
            <li>
              Сохраняет <strong>снимок</strong> — полную спецификацию и расчёт на
              момент создания. Если потом изменить правила, старые заказы не
              изменятся.
            </li>
          </ol>
          <Hint>
            Цену любой позиции можно переопределить вручную (с указанием
            причины). Это полезно для скидок, нестандартных заказов и т.д.
          </Hint>
        </Section>

        {/* Special cases */}
        <Section title="5. Особые случаи">
          <div className="space-y-3">
            <div>
              <strong>Услуги</strong> — всегда ручная цена. Правила
              ценообразования для них не нужны. Оператор вводит описание и
              стоимость при добавлении.
            </div>
            <div>
              <strong>Доп. опции</strong> — берут цену по умолчанию из
              справочника (если задана). Можно переопределить при добавлении.
            </div>
            <div>
              <strong>Ручная цена</strong> — любую позицию можно пересчитать
              вручную. Требуется указать причину (например, «скидка 10%», «VIP-клиент»).
            </div>
            <div>
              <strong>Нет подходящего правила</strong> — если для типа позиции
              нет ни одного правила в программе клиента, система покажет ошибку и
              попросит либо создать правило, либо ввести цену вручную.
            </div>
          </div>
        </Section>

        {/* Quick start */}
        <Section title="Быстрый старт">
          <ol className="list-decimal ml-5 space-y-1">
            <li>Проверьте <strong>Справочники</strong> — добавьте нужные форматы и материалы</li>
            <li>Откройте <strong>Прайсы</strong> → программу «Стандарт»</li>
            <li>Добавьте правило для фотокниг: тип «Фотокнига», формула «База + за единицу», база = 2000, за единицу = 200, поле = spread_count</li>
            <li>Добавьте правило для печати: тип «Печать», формула «Фиксированная», цена = 50</li>
            <li>Создайте заказ — цены рассчитаются автоматически</li>
          </ol>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-md p-5">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
      {children}
    </div>
  );
}

function CodeExample({ code, desc }: { code: string; desc: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <code className="bg-gray-100 px-2 py-0.5 rounded font-mono text-xs shrink-0">
        {code}
      </code>
      <span className="text-gray-600">— {desc}</span>
    </div>
  );
}

function FormulaCard({
  name,
  formula,
  example,
}: {
  name: string;
  formula: string;
  example: string;
}) {
  return (
    <div className="border border-gray-200 rounded-md p-3">
      <div className="font-medium text-sm">{name}</div>
      <div className="text-xs text-gray-500 mt-1 font-mono">{formula}</div>
      <div className="text-xs text-gray-600 mt-2 whitespace-pre-line bg-gray-50 p-2 rounded">
        {example}
      </div>
    </div>
  );
}

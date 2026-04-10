import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/finance", label: "Обзор", end: true },
  { to: "/finance/transactions", label: "Журнал операций" },
  { to: "/finance/debts", label: "Долги поставщикам" },
  { to: "/finance/client-balances", label: "Авансы клиентов" },
  { to: "/finance/partners", label: "Расчёты с партнёрами" },
  { to: "/finance/closing", label: "Закрытие периода" },
];

export function FinanceNav() {
  return (
    <nav className="flex gap-1 border-b border-gray-200 mb-6">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

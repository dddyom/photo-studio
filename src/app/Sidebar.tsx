import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/orders", label: "Заказы", icon: "📋" },
  { to: "/production", label: "Производство", icon: "🔧" },
  { to: "/clients", label: "Клиенты", icon: "👥" },
  { to: "/pricing", label: "Прайсы", icon: "💰" },
  { to: "/catalogs", label: "Справочники", icon: "📚" },
  { to: "/finance", label: "Финансы", icon: "🏦" },
  { to: "/settings", label: "Настройки", icon: "⚙️" },
];

export function Sidebar() {
  return (
    <nav className="w-56 shrink-0 flex flex-col bg-slate-800 text-slate-300">
      <div className="px-4 py-5 text-lg font-bold text-white border-b border-white/10">
        Photo Studio
      </div>
      <ul className="py-2 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `sidebar-link flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.08] ${
                  isActive ? "active" : ""
                }`
              }
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

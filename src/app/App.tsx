import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppShell } from "./AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { PricingPage } from "@/pages/PricingPage";
import { CatalogsPage } from "@/pages/CatalogsPage";
import { FinanceRouter } from "@/pages/finance/FinanceRouter";
import { SettingsPage } from "@/pages/SettingsPage";
import { PricingHelpPage } from "@/pages/PricingHelpPage";

export function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { fontSize: "14px" },
        }}
      />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/orders/*" element={<OrdersPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/pricing/help" element={<PricingHelpPage />} />
          <Route path="/catalogs" element={<CatalogsPage />} />
          <Route path="/finance/*" element={<FinanceRouter />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

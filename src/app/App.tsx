import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AppShell } from "./AppShell";
import { OrdersPage } from "@/pages/OrdersPage";
import { ClientsPage } from "@/pages/ClientsPage";
import { ClientCardPage } from "@/pages/clients/ClientCardPage";
import { PricingPage } from "@/pages/PricingPage";
import { CatalogsPage } from "@/pages/CatalogsPage";
import { FinanceRouter } from "@/pages/finance/FinanceRouter";
import { ProductionPage } from "@/pages/ProductionPage";
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
          <Route path="/" element={<Navigate to="/orders" replace />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrdersPage />} />
          <Route path="/production" element={<ProductionPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientCardPage />} />
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

import { Routes, Route, Navigate } from "react-router-dom";
import { FinanceDashboard } from "./FinanceDashboard";
import { TransactionJournal } from "./TransactionJournal";
import { SupplierDebts } from "./SupplierDebts";
import { PartnerSettlements } from "./PartnerSettlements";
import { ClientBalancesPage } from "./ClientBalancesPage";

export function FinanceRouter() {
  return (
    <Routes>
      <Route index element={<FinanceDashboard />} />
      <Route path="transactions" element={<TransactionJournal />} />
      <Route path="debts" element={<SupplierDebts />} />
      <Route path="partners" element={<PartnerSettlements />} />
      <Route path="client-balances" element={<ClientBalancesPage />} />
      <Route path="*" element={<Navigate to="/finance" replace />} />
    </Routes>
  );
}

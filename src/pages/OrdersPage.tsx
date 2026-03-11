import { Routes, Route } from "react-router-dom";
import { OrdersListPage } from "./orders/OrdersListPage";
import { OrderCreatePage } from "./orders/OrderCreatePage";
import { OrderDetailPage } from "./orders/OrderDetailPage";

export function OrdersPage() {
  return (
    <Routes>
      <Route index element={<OrdersListPage />} />
      <Route path="new" element={<OrderCreatePage />} />
      <Route path=":id" element={<OrderDetailPage />} />
    </Routes>
  );
}

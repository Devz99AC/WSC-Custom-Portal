import { useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./components/Login";
import { AppShell } from "./components/AppShell";
import { OrdersListPage } from "./components/OrdersListPage";
import { OrderPage } from "./components/OrderPage";
import { PaymentsPage } from "./components/PaymentsPage";
import { DocumentsPage } from "./components/DocumentsPage";
import { DocumentProductPage } from "./components/DocumentProductPage";
import { ProfilePage } from "./components/ProfilePage";
import { useOrders } from "./hooks/useOrders";
import { UnauthorizedError, logout } from "./api/client";

/**
 * Root: the session cookie (ADR-0005), not local state, is the source of truth for
 * "signed in" — on mount we simply try to fetch "My Orders" and let a 401 mean "show
 * Login". This also doubles as the sidebar identity fetch (AppShell), so a client with
 * zero orders still gets in — there is no separate "dashboard" concept anymore (My
 * Orders is the home view; each order's own detail page absorbs what a dashboard used
 * to show). Server data is fetched via TanStack Query — never held here as app state.
 */
export function App() {
  const { data, isPending, isError, error } = useOrders();
  const queryClient = useQueryClient();

  if (isPending) {
    return (
      <div className="wsc-shell">
        <p className="wsc-sub">Loading your portal…</p>
      </div>
    );
  }

  if (error instanceof UnauthorizedError) {
    return <Login />;
  }

  if (isError) {
    return (
      <div className="wsc-shell">
        <p className="err">{error instanceof Error ? error.message : "Something went wrong."}</p>
      </div>
    );
  }

  async function handleSignOut() {
    await logout();
    await queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppShell client={data.client} onSignOut={handleSignOut} />}>
          <Route index element={<Navigate to="/orders" replace />} />
          <Route path="orders" element={<OrdersListPage />} />
          <Route path="orders/:id" element={<OrderPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/:corpId" element={<DocumentProductPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

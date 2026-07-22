import { useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./components/Login";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./components/Dashboard";
import { OrderPage } from "./components/OrderPage";
import { PaymentsPage } from "./components/PaymentsPage";
import { DocumentsPage } from "./components/DocumentsPage";
import { ProfilePage } from "./components/ProfilePage";
import { useDashboard } from "./hooks/useDashboard";
import { UnauthorizedError, logout } from "./api/client";

/**
 * Root: the session cookie (ADR-0005), not local state, is the source of truth for
 * "signed in" — on mount we simply try to fetch the dashboard and let a 401 mean
 * "show Login". Server data is fetched via TanStack Query in the container below —
 * never held here as app state.
 */
export function App() {
  const { data, isPending, isError, error } = useDashboard();
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
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppShell dashboard={data} onSignOut={handleSignOut} />}>
          <Route index element={<Dashboard dashboard={data} />} />
          <Route path="order" element={<OrderPage dashboard={data} />} />
          <Route path="payments" element={<PaymentsPage dashboard={data} />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="profile" element={<ProfilePage dashboard={data} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

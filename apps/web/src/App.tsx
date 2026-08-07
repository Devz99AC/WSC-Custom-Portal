import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Login } from "./components/Login";
import { AppShell } from "./components/AppShell";
import { OrdersListPage } from "./components/OrdersListPage";
import { OrderPage } from "./components/OrderPage";
import { PaymentsPage } from "./components/PaymentsPage";
import { DocumentsPage } from "./components/DocumentsPage";
import { DocumentProductPage } from "./components/DocumentProductPage";
import { LearningCenterPage } from "./components/LearningCenterPage";
import { SupportPage } from "./components/SupportPage";
import { ProfilePage } from "./components/ProfilePage";
import { useOrders } from "./hooks/useOrders";
import { OutdatedClientError, UnauthorizedError, logout } from "./api/client";

/** Marks that this tab has already reloaded itself once for a schema mismatch. Session
 *  scope, so it clears with the tab and never leaks between clients on a shared machine. */
const RELOAD_MARKER = "wsc.reloaded-for-outdated-client";

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

  /**
   * Self-heal a tab that outlived a deploy. The SPA and the BFF ship separately, so a tab
   * left open — or restored with Ctrl+Shift+T — can be running JavaScript older than the
   * API, and no amount of retrying fixes that: only fetching the new bundle does.
   *
   * Reloads at most **once per tab**. Without that guard, a genuine server-side payload
   * bug would put the client in an endless reload loop, which is far worse than an error
   * message — so the second occurrence falls through and is displayed instead.
   */
  const isOutdated = error instanceof OutdatedClientError;
  useEffect(() => {
    if (!isOutdated || sessionStorage.getItem(RELOAD_MARKER) !== null) {
      return;
    }
    sessionStorage.setItem(RELOAD_MARKER, "1");
    window.location.reload();
  }, [isOutdated]);

  // Once a response parses again the tab is on the current bundle, so let the next deploy
  // have its own reload rather than spending this tab's only attempt permanently.
  useEffect(() => {
    if (data !== undefined) {
      sessionStorage.removeItem(RELOAD_MARKER);
    }
  }, [data]);

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
          {/* Same page either way — the slug only decides which video starts expanded. */}
          <Route path="learning" element={<LearningCenterPage />} />
          <Route path="learning/:slug" element={<LearningCenterPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="*" element={<Navigate to="/orders" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

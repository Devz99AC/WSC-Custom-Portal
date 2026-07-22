import { useQueryClient } from "@tanstack/react-query";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
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

  return <Dashboard dashboard={data} onSignOut={handleSignOut} />;
}

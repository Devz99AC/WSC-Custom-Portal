import { useState } from "react";
import { Login } from "./components/Login";
import { Dashboard } from "./components/Dashboard";
import { useDashboard } from "./hooks/useDashboard";

/**
 * Root: holds the (demo) session identity in local UI state and routes between the
 * Login screen and the authenticated Dashboard. Server data is fetched via TanStack
 * Query in the container below — never held here as app state.
 */
export function App() {
  const [email, setEmail] = useState<string | null>(null);

  if (!email) {
    return <Login onSignIn={setEmail} />;
  }
  return <DashboardContainer email={email} onSignOut={() => setEmail(null)} />;
}

interface DashboardContainerProps {
  email: string;
  onSignOut: () => void;
}

function DashboardContainer({ email, onSignOut }: DashboardContainerProps) {
  const { data, isPending, isError, error } = useDashboard(email);

  if (isPending) {
    return (
      <div className="wsc-shell">
        <p className="wsc-sub">Loading your portal…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="wsc-shell">
        <p className="err">{error instanceof Error ? error.message : "Something went wrong."}</p>
        <button className="btn-gold" onClick={onSignOut}>
          Back to sign in
        </button>
      </div>
    );
  }

  return <Dashboard dashboard={data} onSignOut={onSignOut} />;
}

import { NavLink, Outlet } from "react-router-dom";
import type { Client } from "@wsc/shared";

const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface AppShellProps {
  client: Client;
  onSignOut: () => void;
}

const navClass = ({ isActive }: { isActive: boolean }): string => `nav-i${isActive ? " on" : ""}`;

/**
 * Shell shared by every authenticated view (ADR-0005 session-driven layout, ported from
 * apps/web/public/prototype.html) — sidebar nav + signed-in client, with routed pages
 * rendered via <Outlet/>. "My Orders" is the home view (there is no separate dashboard).
 */
export function AppShell({ client, onSignOut }: AppShellProps) {
  return (
    <div className="shell">
      <aside className="side">
        <div className="side-logo">
          <div className="wsc-logo">
            WS<span className="c">C</span>
          </div>
          <div className="sl-sub">
            <b>W</b>HOLESALE<b>S</b>HELF<b>C</b>ORP
          </div>
        </div>
        <NavLink to="/orders" className={navClass}>
          My Orders
        </NavLink>
        <NavLink to="/payments" className={navClass}>
          Payments
        </NavLink>
        <NavLink to="/documents" className={navClass}>
          Documents
        </NavLink>
        <NavLink to="/profile" className={navClass}>
          Profile
        </NavLink>
        <div className="side-foot">
          <div className="side-user">
            <div className="ava">{initials(client.name)}</div>
            <div>
              <div className="nm">{client.name}</div>
              <div className="em">{client.businessName ?? client.email}</div>
            </div>
          </div>
          <button className="signout" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

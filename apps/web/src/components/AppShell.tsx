import { NavLink, Outlet } from "react-router-dom";
import type { OrderDashboardDto } from "@wsc/shared";

const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface AppShellProps {
  dashboard: OrderDashboardDto;
  onSignOut: () => void;
}

const navClass = ({ isActive }: { isActive: boolean }): string => `nav-i${isActive ? " on" : ""}`;

/**
 * Shell shared by every authenticated view (ADR-0005 session-driven layout, ported from
 * apps/web/public/prototype.html) — sidebar nav + signed-in client, with routed pages
 * rendered via <Outlet/>. Extracted out of Dashboard so all 5 prototype views can share it.
 */
export function AppShell({ dashboard, onSignOut }: AppShellProps) {
  const { client } = dashboard;

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
        <NavLink to="/" end className={navClass}>
          Dashboard
        </NavLink>
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

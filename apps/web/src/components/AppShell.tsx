import { NavLink, Outlet } from "react-router-dom";
import type { Client } from "@wsc/shared";
import { WscLogo } from "./WscLogo";

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
          <WscLogo variant="short" />
        </div>
        {/* Grouped so the links can become a wrapping row of their own below the logo on a
            phone, where the sidebar turns into a header (theme.css ≤640px). */}
        <nav className="side-nav" aria-label="Sections">
          <NavLink to="/orders" className={navClass}>
            My Orders
          </NavLink>
          <NavLink to="/payments" className={navClass}>
            Payments
          </NavLink>
          <NavLink to="/documents" className={navClass}>
            Documents
          </NavLink>
          <NavLink to="/learning" className={navClass}>
            Learning Center
          </NavLink>
          <NavLink to="/support" className={navClass}>
            Support
          </NavLink>
          <NavLink to="/profile" className={navClass}>
            Profile
          </NavLink>
        </nav>
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

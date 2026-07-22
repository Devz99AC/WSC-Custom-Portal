import type { OrderDashboardDto } from "@wsc/shared";

const formatDate = (iso: string | null): string | null =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;

const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface ProfilePageProps {
  dashboard: OrderDashboardDto;
}

/**
 * "Profile" — ported from apps/web/public/prototype.html, minus its fake "Preferred
 * language" / "Notifications" fields and non-functional 2FA toggle (no settings API
 * backs those yet). The security card instead describes the REAL sign-in mechanism
 * (ADR-0005 magic-link) rather than a button that would do nothing when clicked.
 */
export function ProfilePage({ dashboard }: ProfilePageProps) {
  const { client, order } = dashboard;
  const since = formatDate(order.placedAt);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">Profile</h2>
          <p>Your contact and account details</p>
        </div>
      </div>

      <div className="card">
        <div className="card-h">Account holder</div>
        <div className="prod">
          <div className="ava" style={{ width: "48px", height: "48px", fontSize: "16px" }}>
            {initials(client.name)}
          </div>
          <div>
            <div className="pn">{client.name}</div>
            <div className="pd">
              {since ? `Client since ${since}` : "Client"}
              {client.businessName ? ` · ${client.businessName}` : ""}
            </div>
          </div>
        </div>
        <div className="kv">
          <div>
            <div className="k">Email</div>
            <div className="v">{client.email}</div>
          </div>
          {client.phone && (
            <div>
              <div className="k">Phone</div>
              <div className="v">{client.phone}</div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-h">Sign-in security</div>
        <p className="statusnote">
          You sign in with a one-time secure link sent to {client.email} — there&apos;s no
          password to create, remember, or leak.
        </p>
      </div>
    </>
  );
}

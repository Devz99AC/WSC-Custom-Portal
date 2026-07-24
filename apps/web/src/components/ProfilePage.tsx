import { useOrders } from "../hooks/useOrders";
import { UnauthorizedError } from "../api/client";

const formatDate = (iso: string | null): string | null =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;

const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * "Profile" — ported from apps/web/public/prototype.html, minus its fake "Preferred
 * language" / "Notifications" fields and non-functional 2FA toggle (no settings API
 * backs those yet). The security card instead describes the REAL sign-in mechanism
 * (ADR-0005 magic-link) rather than a button that would do nothing when clicked.
 * Self-fetches (rather than taking a single-order dashboard prop) since a client can
 * have multiple orders — "client since" is derived from the earliest one.
 */
export function ProfilePage() {
  const { data, isPending, isError, error } = useOrders();

  if (isPending) {
    return <p className="statusnote">Loading your profile…</p>;
  }

  if (isError) {
    return (
      <p className="err">
        {error instanceof UnauthorizedError
          ? "Your session has expired — refresh the page to sign in again."
          : error instanceof Error
            ? error.message
            : "Something went wrong."}
      </p>
    );
  }

  const { client, orders } = data;
  const earliestPlacedAt = orders
    .map((order) => order.placedAt)
    .filter((placedAt): placedAt is string => placedAt !== null)
    .sort()[0];
  const since = earliestPlacedAt ? formatDate(earliestPlacedAt) : null;

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

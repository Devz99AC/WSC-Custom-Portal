import { orderStageLabel, type OrderDashboardDto } from "@wsc/shared";
import { OrderTracker } from "./OrderTracker";

const money = (n: number): string => `$${n.toLocaleString("en-US")}`;

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface DashboardProps {
  dashboard: OrderDashboardDto;
  onSignOut: () => void;
}

export function Dashboard({ dashboard, onSignOut }: DashboardProps) {
  const { client, order, payments } = dashboard;
  const corp = order.shelfCorp;
  const firstName = client.name.split(" ")[0] ?? client.name;
  const verifiedCount = payments.filter((payment) => payment.isVerified).length;

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
        <div className="nav-i on">Dashboard</div>
        <div className="nav-i">My Order</div>
        <div className="nav-i">Payments</div>
        <div className="nav-i">Documents</div>
        <div className="nav-i">Profile</div>
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
        <div className="topbar">
          <div>
            <h2 className="disp">Good afternoon, {firstName}</h2>
            <p>Here&apos;s where your order stands today.</p>
          </div>
          <button className="help-btn">Contact advisor</button>
        </div>

        <div className="stat-grid">
          <div className="stat">
            <div className="lab">Order total</div>
            <div className="val">{money(order.amount)}</div>
            <div className="sub2">Order {order.orderNumber}</div>
          </div>
          <div className="stat">
            <div className="lab">Paid to date</div>
            <div className="val">{money(order.paidToDate)}</div>
            <div className="sub2">{verifiedCount} payments verified</div>
          </div>
          <div className="stat">
            <div className="lab">Balance due</div>
            <div className="val red">{money(order.balanceDue)}</div>
            <div className="sub2">Due before shipping</div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">Order progress</div>
          <OrderTracker statusSf={order.statusSf} />
          <div className="statusline">
            <span className="badge b-ok">{orderStageLabel(order.statusSf)}</span>
            <span className="statusnote">
              Our team is preparing your corporation&apos;s credit-ready features.
            </span>
          </div>
        </div>

        {corp && (
          <div className="card">
            <div className="card-h">Product purchased</div>
            <div className="prod">
              <div className="prod-ic">🏛️</div>
              <div>
                <div className="pn">Aged Shelf Corporation — {corp.name}</div>
                <div className="pd">
                  Credit-Ready package. {corp.agedYears} years time-in-business on transfer.
                </div>
              </div>
            </div>
            <div className="kv">
              <div>
                <div className="k">Entity type</div>
                <div className="v">{corp.entityType}</div>
              </div>
              <div>
                <div className="k">State of formation</div>
                <div className="v">{corp.stateOfFormation}</div>
              </div>
              <div>
                <div className="k">Credit-ready features</div>
                <div className="v">{corp.creditReadyFeatures.length} included</div>
              </div>
              <div>
                <div className="k">Assigned advisor</div>
                <div className="v">{order.advisorName ?? "—"}</div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-h">Payment history</div>
          <table className="lst">
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id}>
                  <td>{formatDate(payment.statusDate)}</td>
                  <td>{payment.method}</td>
                  <td className="tnum">{money(payment.amount)}</td>
                  <td>
                    <span className={`badge ${payment.isVerified ? "b-ok" : "b-warn"}`}>
                      {payment.isVerified ? "Verified" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
              <tr>
                <td>—</td>
                <td>Balance payment</td>
                <td className="tnum">{money(order.balanceDue)}</td>
                <td>
                  <span className="badge b-warn">Pending</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

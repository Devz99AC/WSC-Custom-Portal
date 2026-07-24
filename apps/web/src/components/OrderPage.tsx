import { Link, useParams } from "react-router-dom";
import { orderStageLabel } from "@wsc/shared";
import { useOrder } from "../hooks/useOrder";
import { UnauthorizedError } from "../api/client";
import { OrderTracker } from "./OrderTracker";

const money = (n: number): string => `$${n.toLocaleString("en-US")}`;

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

/**
 * Order detail — one order, resolved from the `:id` route param and scoped server-side
 * to the signed-in client (row-level authz, server.ts). This is the sole "everything
 * about this order" view (totals, progress, product, payment history) now that there is
 * no separate single-order dashboard — My Orders links straight in here.
 */
export function OrderPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, isError, error } = useOrder(id);

  if (isPending) {
    return <p className="statusnote">Loading order…</p>;
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

  const { order, payments } = data;
  const corp = order.shelfCorp;
  const verifiedCount = payments.filter((payment) => payment.isVerified).length;

  return (
    <>
      <div className="topbar">
        <div>
          <Link to="/orders" className="statusnote">
            ← My Orders
          </Link>
          <h2 className="disp">Order {order.orderNumber}</h2>
          <p>{order.placedAt ? `Placed ${formatDate(order.placedAt)}` : ""}</p>
        </div>
        <span className="badge b-ok">{orderStageLabel(order.statusSf)}</span>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="lab">Order total</div>
          <div className="val">{money(order.amount)}</div>
        </div>
        <div className="stat">
          <div className="lab">Paid to date</div>
          <div className="val">{money(order.paidToDate)}</div>
          <div className="sub2">{verifiedCount} payments verified</div>
        </div>
        <div className="stat">
          <div className="lab">Balance due</div>
          <div className="val red">{money(order.balanceDue)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">Order progress</div>
        <OrderTracker statusSf={order.statusSf} />
        <div className="statusline">
          <span className="badge b-ok">{orderStageLabel(order.statusSf)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-h">Product purchased</div>
        {corp ? (
          <>
            <div className="prod">
              <div className="prod-ic">🏛️</div>
              <div>
                <div className="pn">{corp.name}</div>
                <div className="pd">
                  {corp.agedYears > 0
                    ? `${corp.agedYears}-year aged ${corp.entityType}, Credit-Ready package.`
                    : `Newly formed ${corp.entityType}. Credit-ready feature setup has not started yet.`}
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
                <div className="k">Incorporated</div>
                <div className="v">{formatDate(corp.incorporationDate)}</div>
              </div>
              <div>
                <div className="k">Assigned advisor</div>
                <div className="v">{order.advisorName ?? "Not yet assigned"}</div>
              </div>
            </div>
          </>
        ) : (
          <p className="statusnote">No shelf corporation is linked to this order yet.</p>
        )}
      </div>

      <div className="card">
        <div className="card-h">Payment history</div>
        <div className="tbl-wrap">
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
              {order.balanceDue > 0 && (
                <tr>
                  <td>—</td>
                  <td>Balance payment</td>
                  <td className="tnum">{money(order.balanceDue)}</td>
                  <td>
                    <span className="badge b-warn">Pending</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

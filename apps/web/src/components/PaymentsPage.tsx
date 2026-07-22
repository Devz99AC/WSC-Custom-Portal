import type { OrderDashboardDto } from "@wsc/shared";

const money = (n: number): string => `$${n.toLocaleString("en-US")}`;

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

interface PaymentsPageProps {
  dashboard: OrderDashboardDto;
}

/** "Payments" — ported from apps/web/public/prototype.html. */
export function PaymentsPage({ dashboard }: PaymentsPageProps) {
  const { order, payments } = dashboard;
  const fullyPaid = order.balanceDue <= 0;

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">Payments</h2>
          <p>All payments tied to order {order.orderNumber}</p>
        </div>
      </div>

      <div className={`alert${fullyPaid ? " ok" : ""}`}>
        <div>
          <div className="at">{fullyPaid ? "Fully paid" : "Balance due"}</div>
          <div className="ad">
            {fullyPaid
              ? "Both payments verified — no balance remaining."
              : `${money(order.balanceDue)} remaining before shipping.`}
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="lab">Total</div>
          <div className="val">{money(order.amount)}</div>
        </div>
        <div className="stat">
          <div className="lab">Verified</div>
          <div className="val">{money(order.paidToDate)}</div>
        </div>
        <div className="stat">
          <div className="lab">Remaining</div>
          <div className={`val${order.balanceDue > 0 ? " red" : ""}`}>{money(order.balanceDue)}</div>
        </div>
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
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

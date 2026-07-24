import { Link } from "react-router-dom";
import { useOrders } from "../hooks/useOrders";
import { usePayments } from "../hooks/usePayments";
import { UnauthorizedError } from "../api/client";

const money = (n: number): string => `$${n.toLocaleString("en-US")}`;

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/** "Payments" — every payment across every one of the client's orders, with totals
 *  aggregated across orders (not just one). Each row links back to its order. */
export function PaymentsPage() {
  const orders = useOrders();
  const payments = usePayments();

  if (orders.isPending || payments.isPending) {
    return <p className="statusnote">Loading your payments…</p>;
  }

  const firstError = orders.error ?? payments.error;
  if (orders.isError || payments.isError) {
    return (
      <p className="err">
        {firstError instanceof UnauthorizedError
          ? "Your session has expired — refresh the page to sign in again."
          : firstError instanceof Error
            ? firstError.message
            : "Something went wrong."}
      </p>
    );
  }

  const totalAmount = orders.data.orders.reduce((sum, order) => sum + order.amount, 0);
  const totalPaid = orders.data.orders.reduce((sum, order) => sum + order.paidToDate, 0);
  const totalBalance = orders.data.orders.reduce((sum, order) => sum + order.balanceDue, 0);
  const fullyPaid = totalBalance <= 0;

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">Payments</h2>
          <p>Every payment across all of your orders</p>
        </div>
      </div>

      <div className={`alert${fullyPaid ? " ok" : ""}`}>
        <div>
          <div className="at">{fullyPaid ? "Fully paid" : "Balance due"}</div>
          <div className="ad">
            {fullyPaid
              ? "Every order is fully paid — no balance remaining."
              : `${money(totalBalance)} remaining across your orders.`}
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="lab">Total</div>
          <div className="val">{money(totalAmount)}</div>
        </div>
        <div className="stat">
          <div className="lab">Paid</div>
          <div className="val">{money(totalPaid)}</div>
        </div>
        <div className="stat">
          <div className="lab">Remaining</div>
          <div className={`val${totalBalance > 0 ? " red" : ""}`}>{money(totalBalance)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">Payment history</div>
        {payments.data.payments.length === 0 ? (
          <p className="statusnote">No payments recorded yet.</p>
        ) : (
          <div className="tbl-wrap">
            <table className="lst">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Order</th>
                  <th>Method</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.statusDate)}</td>
                    <td>{payment.productName ?? "—"}</td>
                    <td>
                      <Link to={`/orders/${payment.orderId}`}>{payment.orderNumber}</Link>
                    </td>
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
        )}
      </div>
    </>
  );
}

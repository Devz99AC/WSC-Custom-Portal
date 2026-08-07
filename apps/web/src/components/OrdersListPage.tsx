import { Link } from "react-router-dom";
import { useOrders } from "../hooks/useOrders";
import { UnauthorizedError } from "../api/client";
import { formatSalesforceDate } from "../lib/date";
import { orderStatusBadgeClass, orderStatusLabel } from "../lib/order-status";

const money = (n: number): string => `$${n.toLocaleString("en-US")}`;

const formatDate = (iso: string | null): string =>
  formatSalesforceDate(iso, { month: "short", day: "numeric", year: "numeric" }) ?? "—";

/** "My Orders" — the list companion to the per-order detail page (OrderPage). Fetches
 *  its own data (every order for the signed-in client) rather than reusing the
 *  single-order dashboard payload. */
export function OrdersListPage() {
  const { data, isPending, isError, error } = useOrders();

  if (isPending) {
    return <p className="statusnote">Loading your orders…</p>;
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

  const { orders } = data;

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">My Orders</h2>
          <p>
            {orders.length} order{orders.length === 1 ? "" : "s"} on file
          </p>
        </div>
      </div>

      <div className="card">
        {orders.length === 0 ? (
          <p className="statusnote">
            No orders on file yet — once your advisor places one, it will show up here.
          </p>
        ) : (
          <div className="tbl-wrap">
            {/* Roles are explicit because the ≤640px card layout overrides `display`,
                which drops them — see theme.css "TABLE". */}
            <table className="lst" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader">Order</th>
                  <th role="columnheader">Placed</th>
                  <th role="columnheader">Product</th>
                  <th role="columnheader">Amount</th>
                  <th role="columnheader">Balance</th>
                  <th role="columnheader">Status</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {orders.map((order) => (
                  <tr key={order.id} className="rowlink" role="row">
                    <td role="cell" data-label="Order">
                      <Link className="rowlink-a" to={`/orders/${order.id}`}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td role="cell" data-label="Placed">
                      {formatDate(order.placedAt)}
                    </td>
                    <td role="cell" data-label="Product">
                      {order.shelfCorp?.name ?? "—"}
                    </td>
                    <td role="cell" data-label="Amount" className="tnum">
                      {money(order.amount)}
                    </td>
                    <td role="cell" data-label="Balance" className="tnum">
                      {order.balanceDue > 0 ? money(order.balanceDue) : "—"}
                    </td>
                    <td role="cell" data-label="Status">
                      <span className={`badge ${orderStatusBadgeClass(order.statusSf)}`}>
                        {orderStatusLabel(order.statusSf)}
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

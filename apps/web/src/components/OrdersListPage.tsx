import { Link } from "react-router-dom";
import { orderStageLabel } from "@wsc/shared";
import { useOrders } from "../hooks/useOrders";
import { UnauthorizedError } from "../api/client";

const money = (n: number): string => `$${n.toLocaleString("en-US")}`;

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

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
            <table className="lst">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Placed</th>
                  <th>Product</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="rowlink">
                    <td>
                      <Link className="rowlink-a" to={`/orders/${order.id}`}>
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td>{formatDate(order.placedAt)}</td>
                    <td>{order.shelfCorp?.name ?? "—"}</td>
                    <td className="tnum">{money(order.amount)}</td>
                    <td className="tnum">{order.balanceDue > 0 ? money(order.balanceDue) : "—"}</td>
                    <td>
                      <span className="badge b-ok">{orderStageLabel(order.statusSf)}</span>
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

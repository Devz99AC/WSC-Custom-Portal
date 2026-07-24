import { Link } from "react-router-dom";
import { useOrders } from "../hooks/useOrders";
import { UnauthorizedError } from "../api/client";

/**
 * "Documents" — segmented by PRODUCT (the shelf corp purchased), not by order number:
 * a client recognizes "2016 Wyoming LLC", not "UO1423102". Still an honest empty state
 * per product (no real document-vault backend yet, Phase 3) — clicking a product goes
 * to DocumentProductPage, which will hold the real files once that adapter exists.
 */
export function DocumentsPage() {
  const { data, isPending, isError, error } = useOrders();

  if (isPending) {
    return <p className="statusnote">Loading your documents…</p>;
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

  const products = new Map<string, { name: string; entityType: string; orderNumbers: string[] }>();
  for (const order of data.orders) {
    if (!order.shelfCorp) {
      continue;
    }
    const existing = products.get(order.shelfCorp.id);
    if (existing) {
      existing.orderNumbers.push(order.orderNumber);
    } else {
      products.set(order.shelfCorp.id, {
        name: order.shelfCorp.name,
        entityType: order.shelfCorp.entityType,
        orderNumbers: [order.orderNumber],
      });
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">Documents</h2>
          <p>Files and notes shared by your team, by product</p>
        </div>
      </div>

      <div className="card">
        {products.size === 0 ? (
          <p className="statusnote">
            No products with documents yet — once your advisor assigns a shelf corporation
            to an order, it will show up here.
          </p>
        ) : (
          <div className="tbl-wrap">
            <table className="lst">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Entity type</th>
                  <th>Order(s)</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(products.entries()).map(([corpId, product]) => (
                  <tr key={corpId} className="rowlink">
                    <td>
                      <Link className="rowlink-a" to={`/documents/${corpId}`}>
                        {product.name}
                      </Link>
                    </td>
                    <td>{product.entityType}</td>
                    <td>{product.orderNumbers.join(", ")}</td>
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

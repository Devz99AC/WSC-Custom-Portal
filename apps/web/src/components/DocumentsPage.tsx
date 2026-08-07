import { Link } from "react-router-dom";
import { useOrders } from "../hooks/useOrders";
import { useDocuments } from "../hooks/useDocuments";
import { UnauthorizedError } from "../api/client";
import { UNFILED_PRODUCT_ID, groupDocumentsByProduct } from "../lib/documents";

const errorMessage = (error: unknown): string =>
  error instanceof UnauthorizedError
    ? "Your session has expired — refresh the page to sign in again."
    : error instanceof Error
      ? error.message
      : "Something went wrong.";

/**
 * "Documents" — segmented by PRODUCT (the shelf corp purchased), not by order number:
 * a client recognizes "Devin LLC", not "UO1423102". The files themselves live on the
 * order in Salesforce; the product is the order's corp (see lib/documents.ts).
 */
export function DocumentsPage() {
  const orders = useOrders();
  const documents = useDocuments();

  if (orders.isPending || documents.isPending) {
    return <p className="statusnote">Loading your documents…</p>;
  }

  if (orders.isError || documents.isError) {
    return <p className="err">{errorMessage(orders.error ?? documents.error)}</p>;
  }

  const products = groupDocumentsByProduct(orders.data.orders, documents.data.documents);

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">Documents</h2>
          <p>Files shared by your team, by product</p>
        </div>
      </div>

      <div className="card">
        {products.length === 0 ? (
          <p className="statusnote">
            No products with documents yet — once your advisor assigns a shelf corporation to an
            order, it will show up here.
          </p>
        ) : (
          <div className="tbl-wrap">
            {/* Roles are explicit because the ≤640px card layout overrides `display`,
                which drops them — see theme.css "TABLE". */}
            <table className="lst" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader">Product</th>
                  <th role="columnheader">Entity type</th>
                  <th role="columnheader">Order(s)</th>
                  <th role="columnheader">Documents</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {products.map((product) => (
                  <tr key={product.id} className="rowlink" role="row">
                    <td role="cell" data-label="Product">
                      <Link className="rowlink-a" to={`/documents/${product.id}`}>
                        {product.name}
                      </Link>
                    </td>
                    <td role="cell" data-label="Entity type">
                      {product.entityType}
                    </td>
                    <td role="cell" data-label="Order(s)">
                      {product.orderNumbers.join(", ")}
                    </td>
                    <td role="cell" data-label="Documents" className="tnum">
                      {product.documentCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {products.some((product) => product.id === UNFILED_PRODUCT_ID) && (
        <p className="statusnote">
          Some files belong to an order that doesn&apos;t have a shelf corporation assigned yet, so
          they&apos;re grouped separately until your advisor links one.
        </p>
      )}
    </>
  );
}

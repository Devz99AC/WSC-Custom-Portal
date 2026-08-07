import { Link, useParams } from "react-router-dom";
import { useOrders } from "../hooks/useOrders";
import { useDocuments } from "../hooks/useDocuments";
import { UnauthorizedError, documentDownloadUrl } from "../api/client";
import { formatSalesforceDate } from "../lib/date";
import { UNFILED_PRODUCT_ID, documentsForProduct, formatFileSize } from "../lib/documents";

const formatDate = (iso: string | null): string =>
  formatSalesforceDate(iso, { month: "short", day: "numeric", year: "numeric" }) ?? "—";

const errorMessage = (error: unknown): string =>
  error instanceof UnauthorizedError
    ? "Your session has expired — refresh the page to sign in again."
    : error instanceof Error
      ? error.message
      : "Something went wrong.";

/**
 * Documents for one product (shelf corp), resolved from the `:corpId` route param. The
 * files live on `Online_Order__c` in Salesforce; this page shows them under the product
 * the client recognizes. Downloads go through the BFF — the browser never sees a
 * Salesforce URL or token.
 */
export function DocumentProductPage() {
  const { corpId } = useParams<{ corpId: string }>();
  const orders = useOrders();
  const documents = useDocuments();

  if (orders.isPending || documents.isPending) {
    return <p className="statusnote">Loading…</p>;
  }

  if (orders.isError || documents.isError) {
    return <p className="err">{errorMessage(orders.error ?? documents.error)}</p>;
  }

  const productId = corpId ?? "";
  const isUnfiled = productId === UNFILED_PRODUCT_ID;
  const corp = orders.data.orders.find((order) => order.shelfCorp?.id === productId)?.shelfCorp;

  if (!corp && !isUnfiled) {
    return (
      <>
        <div className="topbar">
          <div>
            <Link to="/documents" className="statusnote">
              ← Documents
            </Link>
            <h2 className="disp">Product not found</h2>
          </div>
        </div>
        <div className="card">
          <p className="statusnote">This product isn&apos;t linked to any of your orders.</p>
        </div>
      </>
    );
  }

  const title = corp?.name ?? "Not linked to a product yet";
  const files = documentsForProduct(documents.data.documents, productId);

  return (
    <>
      <div className="topbar">
        <div>
          <Link to="/documents" className="statusnote">
            ← Documents
          </Link>
          <h2 className="disp">{title}</h2>
          <p>
            {corp
              ? corp.entityType
              : "Files on an order that doesn't have a shelf corporation assigned yet"}
          </p>
        </div>
      </div>
      <div className="card">
        <div className="card-h">Documents</div>
        {files.length === 0 ? (
          <p className="statusnote">
            No documents have been shared yet for {title} — signed paperwork and receipts will
            appear here once your advisor uploads them.
          </p>
        ) : (
          <div className="tbl-wrap">
            {/* Roles are explicit because the ≤640px card layout overrides `display`,
                which drops them — see theme.css "TABLE". */}
            <table className="lst" role="table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader">Document</th>
                  <th role="columnheader">Order</th>
                  <th role="columnheader">Shared</th>
                  <th role="columnheader">Size</th>
                  <th role="columnheader">
                    <span className="vh">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {files.map((file) => (
                  <tr key={file.id} role="row">
                    {/* Name and description are wrapped together so the stacked mobile cell
                        keeps them as one value beside the label, not two. */}
                    <td role="cell" data-label="Document" className="tcell-wide">
                      <div>
                        <span className="rowlink-a">{file.name}</span>
                        {file.description && <div className="pd">{file.description}</div>}
                      </div>
                    </td>
                    <td role="cell" data-label="Order">
                      {file.orderNumber}
                    </td>
                    <td role="cell" data-label="Shared">
                      {formatDate(file.sharedAt)}
                    </td>
                    <td role="cell" data-label="Size" className="tnum">
                      {formatFileSize(file.sizeBytes)}
                    </td>
                    <td role="cell" className="tcell-action">
                      <a className="rowlink-a" href={documentDownloadUrl(file.id)} download>
                        Download
                      </a>
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

import { Link, useParams } from "react-router-dom";
import { useOrders } from "../hooks/useOrders";
import { UnauthorizedError } from "../api/client";

/**
 * Documents for one product (shelf corp), resolved from the `:corpId` route param.
 * Still an honest empty state — no real document-vault backend yet (Phase 3, S3 +
 * Formstack) — but scoped to the product the client actually recognizes.
 */
export function DocumentProductPage() {
  const { corpId } = useParams<{ corpId: string }>();
  const { data, isPending, isError, error } = useOrders();

  if (isPending) {
    return <p className="statusnote">Loading…</p>;
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

  const order = data.orders.find((candidate) => candidate.shelfCorp?.id === corpId);
  const corp = order?.shelfCorp;

  if (!corp) {
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

  return (
    <>
      <div className="topbar">
        <div>
          <Link to="/documents" className="statusnote">
            ← Documents
          </Link>
          <h2 className="disp">{corp.name}</h2>
          <p>{corp.entityType}</p>
        </div>
      </div>
      <div className="card">
        <div className="card-h">Attachments</div>
        <p className="statusnote">
          No documents have been shared yet for {corp.name} — signed paperwork and receipts
          will appear here once your advisor uploads them.
        </p>
      </div>
    </>
  );
}

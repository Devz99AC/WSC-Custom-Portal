import { Link, useParams } from "react-router-dom";
import { orderStageLabel } from "@wsc/shared";
import { useOrder } from "../hooks/useOrder";
import { UnauthorizedError } from "../api/client";

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

/**
 * Order detail — one order, resolved from the `:id` route param and scoped server-side
 * to the signed-in client (row-level authz, server.ts). The status history below shows
 * only what the endpoint actually returns (current stage + when the order was placed)
 * rather than a fabricated multi-step timeline — CLAUDE.md §Prime directive 1.
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

  const { order } = data;
  const corp = order.shelfCorp;

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
        <div className="card-h">Status</div>
        <div className="tl-row">
          <div className="tl-dot r" />
          <div className="tl-body">
            <div className="tt">{orderStageLabel(order.statusSf)}</div>
            <div className="td">Current status.</div>
          </div>
        </div>
        {order.placedAt && (
          <div className="tl-row">
            <div className="tl-dot g" />
            <div className="tl-body">
              <div className="tt">Order placed</div>
              <div className="tm">{formatDate(order.placedAt)}</div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

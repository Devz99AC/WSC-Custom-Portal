import { orderStageLabel, type OrderDashboardDto } from "@wsc/shared";

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "—";

interface OrderPageProps {
  dashboard: OrderDashboardDto;
}

/**
 * "My Order" — ported from apps/web/public/prototype.html. The status history below
 * shows only what the dashboard endpoint actually returns (current stage + when the
 * order was placed) rather than the prototype's fabricated multi-step timeline —
 * CLAUDE.md §Prime directive 1: never invent business records for a real client.
 */
export function OrderPage({ dashboard }: OrderPageProps) {
  const { order } = dashboard;
  const corp = order.shelfCorp;

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">My Order</h2>
          <p>
            Order {order.orderNumber}
            {order.placedAt ? ` · Placed ${formatDate(order.placedAt)}` : ""}
          </p>
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

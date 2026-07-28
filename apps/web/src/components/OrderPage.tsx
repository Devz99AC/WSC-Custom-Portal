import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { orderStageLabel } from "@wsc/shared";
import { useOrder } from "../hooks/useOrder";
import { UnauthorizedError } from "../api/client";
import { formatSalesforceDate } from "../lib/date";
import { OrderTracker } from "./OrderTracker";
import { StaffCard } from "./StaffCard";

const money = (n: number): string => `$${n.toLocaleString("en-US")}`;

const formatDate = (iso: string | null): string =>
  formatSalesforceDate(iso, { month: "long", day: "numeric", year: "numeric" }) ?? "—";

type Detail = { k: string; v: ReactNode };

/** Renders only the rows that actually carry a value — a half-populated Salesforce record
 *  should show a shorter card, not a grid of em-dashes. */
function DetailGrid({ items }: { items: (Detail | null)[] }) {
  const present = items.filter((item): item is Detail => item !== null);
  if (present.length === 0) {
    return null;
  }
  return (
    <div className="kv">
      {present.map((item) => (
        <div key={item.k}>
          <div className="k">{item.k}</div>
          <div className="v">{item.v}</div>
        </div>
      ))}
    </div>
  );
}

const MASKED_EIN = "••-•••••••";

/** The EIN is the corporation's federal tax ID — the client genuinely needs it (their bank
 *  asks for it when opening the business account), but it is PII that shouldn't sit in
 *  plain view during a screen share, so it starts masked behind an explicit reveal. */
function EinValue({ ein }: { ein: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <>
      {revealed ? ein : MASKED_EIN}
      <button type="button" className="reveal" onClick={() => setRevealed(!revealed)}>
        {revealed ? "Hide" : "Show"}
      </button>
    </>
  );
}

/**
 * Order detail — one order, resolved from the `:id` route param and scoped server-side
 * to the signed-in client (row-level authz, server.ts). This is the sole "everything
 * about this order" view (totals, progress, product, payment history) now that there is
 * no separate single-order dashboard — My Orders links straight in here.
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

  const { order, payments } = data;
  const corp = order.shelfCorp;
  const verifiedCount = payments.filter((payment) => payment.isVerified).length;

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

      <div className="stat-grid">
        <div className="stat">
          <div className="lab">Order total</div>
          <div className="val">{money(order.amount)}</div>
        </div>
        <div className="stat">
          <div className="lab">Paid to date</div>
          <div className="val">{money(order.paidToDate)}</div>
          <div className="sub2">{verifiedCount} payments verified</div>
        </div>
        <div className="stat">
          <div className="lab">Balance due</div>
          <div className="val red">{money(order.balanceDue)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">Order progress</div>
        <OrderTracker statusSf={order.statusSf} />
        <div className="statusline">
          <span className="badge b-ok">{orderStageLabel(order.statusSf)}</span>
        </div>
      </div>

      <StaffCard order={order} />

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
            <DetailGrid
              items={[
                { k: "Entity type", v: corp.entityType },
                { k: "State of formation", v: corp.stateOfFormation },
                { k: "Incorporated", v: formatDate(corp.incorporationDate) },
                corp.corpNumber ? { k: "Corp #", v: corp.corpNumber } : null,
                corp.registrationNumber ? { k: "Registration #", v: corp.registrationNumber } : null,
                // EIN lives on Online_Order__c, but it identifies the corporation — this is
                // where a client looks for "my company's tax ID".
                order.ein ? { k: "EIN", v: <EinValue ein={order.ein} /> } : null,
                order.einIssuedAt ? { k: "EIN issued", v: formatDate(order.einIssuedAt) } : null,
                corp.duns ? { k: "D-U-N-S", v: corp.duns } : null,
                corp.creditScore ? { k: "Credit score", v: corp.creditScore } : null,
                corp.fundingCapacity !== null
                  ? { k: "Funding capacity", v: money(corp.fundingCapacity) }
                  : null,
                corp.registeredAgentStatus
                  ? { k: "Registered agent", v: corp.registeredAgentStatus }
                  : null,
                corp.lastAnnualReportDate
                  ? { k: "Last annual report", v: formatDate(corp.lastAnnualReportDate) }
                  : null,
                corp.nextRenewalDate
                  ? { k: "Next renewal", v: formatDate(corp.nextRenewalDate) }
                  : null,
              ]}
            />
          </>
        ) : (
          <p className="statusnote">No shelf corporation is linked to this order yet.</p>
        )}
      </div>

      <div className="card">
        <div className="card-h">Order details</div>
        <DetailGrid
          items={[
            { k: "Order number", v: order.orderNumber },
            order.placedAt ? { k: "Order date", v: formatDate(order.placedAt) } : null,
            order.paymentMethod ? { k: "Payment method", v: order.paymentMethod } : null,
            order.paymentFrequency ? { k: "Payment schedule", v: order.paymentFrequency } : null,
            order.fullyPaidAt ? { k: "Paid in full", v: formatDate(order.fullyPaidAt) } : null,
            order.statusUpdatedAt
              ? { k: "Status last updated", v: formatDate(order.statusUpdatedAt) }
              : null,
          ]}
        />
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
              {order.balanceDue > 0 && (
                <tr>
                  <td>—</td>
                  <td>Balance payment</td>
                  <td className="tnum">{money(order.balanceDue)}</td>
                  <td>
                    <span className="badge b-warn">Pending</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

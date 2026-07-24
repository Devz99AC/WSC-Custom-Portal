import { isPostPaymentStage, type Order } from "@wsc/shared";

const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

/**
 * Mock post-purchase Implementation Manager — the org doesn't have a confirmed field for
 * this role yet (ACTION-PLAN Q2/Q5: candidate is `QC_Agent__c`, pending stakeholder
 * confirmation). "Lua" is the stakeholder's own example name from the feedback session,
 * not an invented one — the phone is a placeholder until the real field lands, flagged
 * as such in the UI rather than presented as a working number.
 */
const IMPLEMENTATION_MANAGER = {
  role: "Implementation Manager",
  name: "Lua",
  phone: null,
};

/** Real advisor contact channel — the same "call your advisor" number already used in
 *  the magic-link email template (infrastructure/email/magic-link-template.ts). */
const ADVISOR_PHONE = "+1 (720) 534-2065";

interface StaffCardProps {
  order: Order;
}

/**
 * "Your point of contact" — hands off from the pre-payment Sales Advisor (real name from
 * `Sales_Rep__c`, already live) to the post-payment Implementation Manager (mock — the
 * real field lands once Q2 is confirmed, ACTION-PLAN F1) based on the order's own status.
 */
export function StaffCard({ order }: StaffCardProps) {
  const postPayment = isPostPaymentStage(order.statusSf);

  const role = postPayment ? IMPLEMENTATION_MANAGER.role : "Sales Advisor";
  const name = postPayment ? IMPLEMENTATION_MANAGER.name : (order.advisorName ?? "Not yet assigned");
  const phone = postPayment ? IMPLEMENTATION_MANAGER.phone : (order.advisorName ? ADVISOR_PHONE : null);

  return (
    <div className="card">
      <div className="card-h">Your point of contact</div>
      <div className="prod">
        <div className="ava" style={{ width: "44px", height: "44px", fontSize: "15px" }}>
          {initials(name)}
        </div>
        <div>
          <div className="pn">{name}</div>
          <div className="pd">
            {role}
            {phone ? ` · ${phone}` : ""}
          </div>
          {postPayment && (
            <div className="pd" style={{ marginTop: "4px" }}>
              Direct contact info is pending confirmation — reach out via Support in the
              meantime.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

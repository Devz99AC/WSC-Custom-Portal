import {
  STAFF_ROLE_LABELS,
  staffRolesForStatus,
  type Order,
  type StaffContact,
  type StaffRole,
} from "@wsc/shared";
import { ContactRow } from "./ContactRow";

const CONTACT_BY_ROLE = (order: Order): Record<StaffRole, StaffContact | null> => ({
  advisor: order.advisor,
  "support-manager": order.supportManager,
  "backend-support": order.backEndSupport,
});

/**
 * "Your point of contact." Which people appear is decided by the order's own status
 * (`staffRolesForStatus`): the Sales Advisor while the sale is still open, then the two
 * support roles once payment is verified.
 *
 * Nothing here is invented. A role whose Salesforce lookup is empty renders as "not yet
 * assigned" rather than a placeholder name — real clients read this card, and a made-up
 * contact is worse than an honest gap.
 */
export function StaffCard({ order }: { order: Order }) {
  const roles = staffRolesForStatus(order.statusSf);
  const byRole = CONTACT_BY_ROLE(order);
  const handedOff = !roles.includes("advisor");

  return (
    <div className="card">
      <div className="card-h">{roles.length > 1 ? "Your points of contact" : "Your point of contact"}</div>

      {roles.map((role) => {
        const contact = byRole[role];
        return contact ? (
          <ContactRow key={role} contact={contact} />
        ) : (
          <p key={role} className="statusnote">
            {STAFF_ROLE_LABELS[role]} — not yet assigned. Your team will introduce them shortly.
          </p>
        );
      })}

      {handedOff && (
        <p className="statusnote handoff">
          Your sales advisor&apos;s part is complete now that the sale has closed. From here
          on, everything about this order goes through the support contacts above.
        </p>
      )}
    </div>
  );
}

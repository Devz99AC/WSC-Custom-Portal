import {
  STAFF_ROLE_LABELS,
  staffRolesForStatus,
  whatsAppLink,
  type Order,
  type StaffContact,
  type StaffRole,
} from "@wsc/shared";

const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

function ContactRow({ contact }: { contact: StaffContact }) {
  const whatsApp = whatsAppLink(contact.whatsAppNumber);

  return (
    <div className="prod">
      <div className="ava" style={{ width: "44px", height: "44px", fontSize: "15px" }}>
        {initials(contact.name)}
      </div>
      <div>
        <div className="pn">{contact.name}</div>
        <div className="pd">{STAFF_ROLE_LABELS[contact.role]}</div>
        <div className="contact-lines">
          {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>}
          {whatsApp && (
            <a href={whatsApp} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

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

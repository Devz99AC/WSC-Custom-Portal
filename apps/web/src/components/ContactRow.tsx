import { STAFF_ROLE_LABELS, whatsAppLink, type StaffContact } from "@wsc/shared";

const initials = (name: string): string =>
  name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

interface ContactRowProps {
  contact: StaffContact;
  /** What this role handles (`STAFF_ROLE_PURPOSE`). Shown on the Support page, where the
   *  client's question is "who do I ask?", and omitted on an order's own card, where the
   *  answer is already obvious from context. */
  purpose?: string;
  /** Which products this person covers — only worth rendering when the client has more
   *  than one order, otherwise it restates the page they're already on. */
  covers?: readonly string[];
}

/**
 * One person, with every channel they can actually be reached on.
 *
 * Shared by the order detail card and the Support page so the rules live in one place:
 * a channel the team member hasn't filled in is omitted rather than rendered as a dead
 * link, and the WhatsApp link is built from the stored number rather than typed by hand.
 */
export function ContactRow({ contact, purpose, covers }: ContactRowProps) {
  const whatsApp = whatsAppLink(contact.whatsAppNumber);

  return (
    <div className="prod">
      <div className="ava" style={{ width: "44px", height: "44px", fontSize: "15px" }}>
        {initials(contact.name)}
      </div>
      <div>
        <div className="pn">{contact.name}</div>
        <div className="pd">{STAFF_ROLE_LABELS[contact.role]}</div>
        {purpose !== undefined && <div className="sup-purpose">{purpose}</div>}
        <div className="contact-lines">
          {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          {contact.phone && <a href={`tel:${contact.phone.replace(/\s/g, "")}`}>{contact.phone}</a>}
          {whatsApp && (
            <a href={whatsApp} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
          )}
        </div>
        {covers !== undefined && covers.length > 0 && (
          <div className="sup-covers">For {covers.join(", ")}</div>
        )}
      </div>
    </div>
  );
}

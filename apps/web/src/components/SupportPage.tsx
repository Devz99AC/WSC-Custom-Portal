import {
  STAFF_ROLE_LABELS,
  STAFF_ROLE_PURPOSE,
  WSC_CONTACT,
  telLink,
  whatsAppLink,
} from "@wsc/shared";
import { useOrders } from "../hooks/useOrders";
import { UnauthorizedError } from "../api/client";
import { activeSupportContacts } from "../lib/support";
import { ContactRow } from "./ContactRow";

/** Same rule as a person's channels: a link that can't be built simply isn't rendered.
 *  Both go through the shared builders so the company's own card can't drift from the
 *  staff cards — it did, and shipped a `wa.me` link to the wrong country. */
const companyWhatsApp = whatsAppLink(WSC_CONTACT.phone);
const companyTel = telLink(WSC_CONTACT.phone);

const errorMessage = (error: unknown): string =>
  error instanceof UnauthorizedError
    ? "Your session has expired — refresh the page to sign in again."
    : error instanceof Error
      ? error.message
      : "Something went wrong.";

/**
 * "Support" — who to contact, and what each person handles.
 *
 * Deliberately a contact hub and nothing more. Raising a ticket writes to Salesforce, and
 * the object that was assumed for tickets isn't in use in this org's production (open
 * question Q5), so there is no form here — offering one that quietly went nowhere would be
 * worse than not having it.
 *
 * Everything below is already on screen elsewhere in pieces; what this page adds is the
 * answer to a question no single order can answer: a client with one corp still in Pending
 * Balance and another already in Work Started has three different people to deal with and
 * nowhere that says which is which.
 */
export function SupportPage() {
  const orders = useOrders();

  if (orders.isPending) {
    return <p className="statusnote">Loading your support contacts…</p>;
  }

  if (orders.isError) {
    return <p className="err">{errorMessage(orders.error)}</p>;
  }

  const groups = activeSupportContacts(orders.data.orders);
  // With a single order the "For Devin LLC" line under every person just restates what the
  // client already knows.
  const showCoverage = orders.data.orders.length > 1;
  const handedOff = groups.length > 0 && !groups.some((group) => group.role === "advisor");

  return (
    <>
      <div className="topbar">
        <div>
          <h2 className="disp">Support</h2>
          <p>Who to contact, and what each person handles</p>
        </div>
      </div>

      <div className="card">
        <div className="card-h">Your team</div>

        {groups.length === 0 ? (
          <p className="statusnote">
            You don&apos;t have an active order yet, so no one is assigned to you — reach
            Wholesale Shelf Corporations directly using the details below.
          </p>
        ) : (
          groups.map((group) =>
            group.contact ? (
              <ContactRow
                key={`${group.role}-${group.contact.email ?? group.contact.name}`}
                contact={group.contact}
                purpose={STAFF_ROLE_PURPOSE[group.role]}
                {...(showCoverage ? { covers: group.covers } : {})}
              />
            ) : (
              <p key={group.role} className="statusnote">
                {STAFF_ROLE_LABELS[group.role]} — not yet assigned. Your team will introduce
                them shortly; until then, use the general contact details below.
              </p>
            ),
          )
        )}

        {handedOff && (
          <p className="statusnote handoff">
            Your sales advisor&apos;s part is complete now that the sale has closed. From
            here on, everything goes through the support contacts above.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-h">Wholesale Shelf Corporations</div>
        <div className="kv">
          <div>
            <div className="k">Phone</div>
            <div className="v">
              {companyTel ? (
                <a href={companyTel}>{WSC_CONTACT.phone}</a>
              ) : (
                WSC_CONTACT.phone
              )}
            </div>
          </div>
          <div>
            <div className="k">Email</div>
            <div className="v">
              <a href={`mailto:${WSC_CONTACT.email}`}>{WSC_CONTACT.email}</a>
            </div>
          </div>
          {companyWhatsApp && (
            <div>
              <div className="k">WhatsApp</div>
              <div className="v">
                <a href={companyWhatsApp} target="_blank" rel="noreferrer">
                  Message us
                </a>
              </div>
            </div>
          )}
          <div>
            <div className="k">Office</div>
            <div className="v">
              {WSC_CONTACT.officeLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

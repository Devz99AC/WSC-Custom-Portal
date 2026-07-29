import { staffRolesForStatus, type Order, type StaffContact, type StaffRole } from "@wsc/shared";

/** The order the stakeholder specified: the sale first, then the two support roles. */
const ROLE_ORDER: readonly StaffRole[] = ["advisor", "support-manager", "backend-support"];

export interface SupportContactGroup {
  role: StaffRole;
  /** `null` when the role is active for one of the client's orders but Salesforce has no
   *  one in the lookup yet — surfaced as an honest gap, never as a placeholder person. */
  contact: StaffContact | null;
  /** What this person covers, named the way the client recognises it. */
  covers: string[];
}

const contactFor = (order: Order, role: StaffRole): StaffContact | null => {
  switch (role) {
    case "advisor":
      return order.advisor;
    case "support-manager":
      return order.supportManager;
    case "backend-support":
      return order.backEndSupport;
  }
};

/** The corp the client bought, falling back to the order number while none is assigned —
 *  same rule Documents uses: a client recognises "Devin LLC", not "UO1423102". */
const orderLabel = (order: Order): string => order.shelfCorp?.name ?? order.orderNumber;

/**
 * Who the client should be talking to right now, across ALL their orders.
 *
 * Person-centric rather than order-centric: with two orders in different stages the
 * order-by-order view repeats the same people and still doesn't answer "who do I call?".
 * So each person appears once, carrying the list of products they cover.
 *
 * Which roles are active is still decided per order by `staffRolesForStatus` — a client
 * mid-purchase on one corp and already in support on another legitimately sees all three.
 */
export function activeSupportContacts(orders: readonly Order[]): SupportContactGroup[] {
  const groups = new Map<string, SupportContactGroup>();

  for (const order of orders) {
    for (const role of staffRolesForStatus(order.statusSf)) {
      const contact = contactFor(order, role);
      // Keyed by person, not just role: if two orders genuinely sit with different people
      // in the same role, the client needs to see both rather than one silently winning.
      const key = `${role}|${contact?.email ?? contact?.name ?? ""}`;
      const label = orderLabel(order);
      const existing = groups.get(key);

      if (existing) {
        if (!existing.covers.includes(label)) existing.covers.push(label);
      } else {
        groups.set(key, { role, contact, covers: [label] });
      }
    }
  }

  return [...groups.values()].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role),
  );
}

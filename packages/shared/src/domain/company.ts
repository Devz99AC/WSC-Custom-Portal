/**
 * WSC's own contact details — the company, not a person.
 *
 * Lives in `shared` because both the portal and the BFF's magic-link email quote the same
 * phone number, and two copies of a phone number is a phone number that will eventually
 * disagree with itself.
 *
 * This is the fallback shown when an order has no team assigned yet, and the general line
 * for anything that isn't about a specific order. Per-order contacts are people and come
 * from Salesforce (`StaffContact`) — never from here.
 */
export interface CompanyContact {
  phone: string;
  email: string;
  /** Street address, one line per rendered line — kept as lines so the UI never has to
   *  guess where to break a US address. */
  officeLines: readonly string[];
}

export const WSC_CONTACT: CompanyContact = {
  phone: "(720) 534-2065",
  email: "Support@WholesaleShelfCorporations.com",
  officeLines: ["5500 Greenwood Plaza Blvd, Suite 130", "Greenwood Village, CO 80111"],
};

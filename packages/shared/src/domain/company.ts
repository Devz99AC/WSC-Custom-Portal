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

/**
 * The day WSC actually started trading ("Business Started"), as calendar parts.
 *
 * Every claim the portal makes about the company's own longevity is derived from here. The
 * login screen used to carry "Established 2010 — 16 Years of Experience" typed out by
 * hand, which was wrong twice over: the year was not the real one, and a hand-typed count
 * quietly becomes a lie the next time an anniversary passes.
 *
 * Held as numbers rather than an ISO string so nothing has to parse a date back out of
 * text, and so the month is unambiguously the month (`12/8/2017` reads as two different
 * days depending on which side of the Atlantic you are on).
 */
const BUSINESS_STARTED = { year: 2017, month: 12, day: 8 } as const;

/** The "Established ####" half of the claim, so the two halves cannot drift apart. */
export const WSC_ESTABLISHED_YEAR = BUSINESS_STARTED.year;

/**
 * Completed years in business as of `now` — the anniversary has to have actually passed,
 * so this ticks over on the day itself and not before.
 *
 * Takes `now` instead of reading the clock so it stays pure and testable (CLAUDE.md §2).
 * Compares calendar fields rather than subtracting timestamps, which also sidesteps the
 * UTC-midnight trap that once made date-only values render a day early west of UTC (see
 * `formatSalesforceDate`).
 */
export function yearsInBusiness(now: Date): number {
  const month = now.getMonth() + 1;
  const anniversaryPassed =
    month > BUSINESS_STARTED.month ||
    (month === BUSINESS_STARTED.month && now.getDate() >= BUSINESS_STARTED.day);
  const years = now.getFullYear() - BUSINESS_STARTED.year - (anniversaryPassed ? 0 : 1);
  return Math.max(0, years);
}

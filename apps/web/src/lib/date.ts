const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Salesforce `date` fields are calendar dates with no timezone (`"2026-05-02"`), while
 * `datetime` fields carry an offset (`"2026-07-19T12:36:27.000+0000"`).
 *
 * `new Date("2026-05-02")` reads the first form as UTC midnight, so any viewer west of
 * UTC renders the day before — an order placed May 2 showed as "May 1" for every client
 * in the Americas. Date-only values are therefore built as a LOCAL calendar date;
 * datetimes already pin a real instant and are parsed as-is.
 */
export function parseSalesforceDate(iso: string): Date | null {
  const parts = DATE_ONLY.exec(iso);
  const date = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Formats a Salesforce date/datetime, or returns null when there's nothing to show —
 *  callers decide their own placeholder. */
export function formatSalesforceDate(
  iso: string | null,
  options: Intl.DateTimeFormatOptions,
): string | null {
  if (!iso) {
    return null;
  }
  const date = parseSalesforceDate(iso);
  return date ? date.toLocaleDateString("en-US", options) : null;
}

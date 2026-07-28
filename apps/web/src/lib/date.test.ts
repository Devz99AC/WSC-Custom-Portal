import { describe, expect, it } from "vitest";
import { formatSalesforceDate, parseSalesforceDate } from "./date";

const LONG = { month: "long", day: "numeric", year: "numeric" } as const;

describe("formatSalesforceDate", () => {
  it("keeps a date-only value on the calendar day it names, in any timezone", () => {
    // Regression: `new Date("2026-05-02")` is UTC midnight, so an order placed May 2
    // rendered as "May 1" for every viewer west of UTC — i.e. every US client.
    const date = parseSalesforceDate("2026-05-02");
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(4);
    expect(date?.getDate()).toBe(2);
    expect(formatSalesforceDate("2026-05-02", LONG)).toBe("May 2, 2026");
  });

  it("parses a Salesforce datetime with its offset intact", () => {
    expect(parseSalesforceDate("2026-07-19T12:36:27.000+0000")?.toISOString()).toBe(
      "2026-07-19T12:36:27.000Z",
    );
  });

  it("returns null rather than 'Invalid Date' for missing or malformed values", () => {
    expect(formatSalesforceDate(null, LONG)).toBeNull();
    expect(formatSalesforceDate("not-a-date", LONG)).toBeNull();
  });
});

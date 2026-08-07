import { describe, expect, it } from "vitest";
import { WSC_ESTABLISHED_YEAR, yearsInBusiness } from "./domain/company.js";

/** Local midnight, so the assertions are about calendar days and not about which side of
 *  UTC the machine running them happens to sit on. */
const on = (year: number, month: number, day: number): Date => new Date(year, month - 1, day);

describe("yearsInBusiness", () => {
  it("only counts the year once the anniversary has actually passed", () => {
    // Founding date is 2017-12-08.
    expect(yearsInBusiness(on(2025, 12, 7))).toBe(7);
    expect(yearsInBusiness(on(2025, 12, 8))).toBe(8);
    expect(yearsInBusiness(on(2025, 12, 9))).toBe(8);
  });

  it("holds the count steady across the months between anniversaries", () => {
    expect(yearsInBusiness(on(2026, 1, 1))).toBe(8);
    expect(yearsInBusiness(on(2026, 8, 6))).toBe(8);
    expect(yearsInBusiness(on(2026, 12, 7))).toBe(8);
    // This is the behaviour the hardcoded sentence could not have: it rolls over on its
    // own, with nobody editing the markup.
    expect(yearsInBusiness(on(2026, 12, 8))).toBe(9);
  });

  it("never reports a negative age for a date before the company existed", () => {
    expect(yearsInBusiness(on(2016, 1, 1))).toBe(0);
  });

  it("agrees with the Established year it is rendered next to", () => {
    expect(WSC_ESTABLISHED_YEAR).toBe(2017);
    expect(yearsInBusiness(on(WSC_ESTABLISHED_YEAR, 12, 8))).toBe(0);
  });
});

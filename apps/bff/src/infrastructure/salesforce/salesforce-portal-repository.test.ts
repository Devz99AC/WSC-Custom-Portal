import { describe, expect, it } from "vitest";
import type { SalesforceRecord } from "./salesforce-query.js";
import { SalesforcePortalRepository } from "./salesforce-portal-repository.js";

/**
 * Captures every SOQL string the repository issues, returning no rows so each read falls
 * through its "empty" path without needing fixture records. The point of these tests is the
 * WHERE clause, not the mapping.
 */
const makeRepo = () => {
  const soql: string[] = [];
  const query = async (q: string): Promise<SalesforceRecord[]> => {
    soql.push(q);
    return [];
  };
  const attachmentBody = async (): Promise<Buffer | null> => null;
  return { repo: new SalesforcePortalRepository(query, attachmentBody), soql };
};

// Stakeholder rule (2026-08-07): Cancelled orders and Inactive clients are trash data and
// must NEVER be read by the portal (they are not deleted in Salesforce, just filtered out).
// These assertions freeze the SOQL filters so a future refactor can't silently drop them.
describe("SalesforcePortalRepository — trash-data filter", () => {
  it("keeps Cancelled orders out of the orders list", async () => {
    const { repo, soql } = makeRepo();
    await repo.listOrdersByEmail("marcus@example.com");
    expect(soql[0]).toMatch(/FROM Online_Order__c/);
    expect(soql[0]).toMatch(/NOT Status__c LIKE 'Cancelled%'/);
  });

  it("keeps a Cancelled order out of the single-order read (blocks a direct id too)", async () => {
    const { repo, soql } = makeRepo();
    await repo.getOrderByEmailAndId("marcus@example.com", "a35VF000000Tm1FYAS");
    expect(soql[0]).toMatch(/NOT Status__c LIKE 'Cancelled%'/);
  });

  it("keeps payments of Cancelled orders out of the payments list", async () => {
    const { repo, soql } = makeRepo();
    await repo.listPaymentsByEmail("marcus@example.com");
    expect(soql[0]).toMatch(/FROM Online_Payment__c/);
    expect(soql[0]).toMatch(/NOT Online_Order__r\.Status__c LIKE 'Cancelled%'/);
  });

  it("keeps documents of Cancelled orders out (the parent-order index is filtered too)", async () => {
    const { repo, soql } = makeRepo();
    await repo.listDocumentsByEmail("marcus@example.com");
    expect(soql[0]).toMatch(/FROM Online_Order__c/);
    expect(soql[0]).toMatch(/NOT Status__c LIKE 'Cancelled%'/);
  });

  it("never resolves an Inactive client — the sign-in identity gate", async () => {
    const { repo, soql } = makeRepo();
    await repo.findClientByEmail("inactive@example.com");
    expect(soql[0]).toMatch(/FROM FU_User__c/);
    expect(soql[0]).toMatch(/Status__c != 'Inactive'/);
  });

  it("keeps NULL-status records in — the filters exclude only explicit trash", async () => {
    const { repo, soql } = makeRepo();
    await repo.findClientByEmail("newclient@example.com");
    // A null Status__c is New/unset, not Inactive — a half-filled record must not vanish.
    expect(soql[0]).toMatch(/Status__c = null/);
  });
});

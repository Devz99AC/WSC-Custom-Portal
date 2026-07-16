import type { OrderDashboard } from "@wsc/shared";
import type { PortalRepository } from "../../application/ports/portal-repository.js";

/**
 * In-memory adapter for the demo. The data has the EXACT shape the Salesforce adapter
 * will return (fields mapped from FU_User__c / Online_Order__c / Online_Payment__c /
 * SC_Corp__c — see docs/salesforce-data-model.md), so switching to live Salesforce is a
 * one-line change in the composition root. Mirrors the prototype's sample order OO-1042.
 */
const DEMO_EMAIL = "m.brown@acmeholdings.com";

const DEMO_DASHBOARD: OrderDashboard = {
  client: {
    id: "a0Fdemo0000000001",
    email: DEMO_EMAIL,
    name: "Marcus Brown",
    phone: "+1 (305) 555-0148",
    businessName: "Acme Holdings LLC",
  },
  order: {
    id: "a0Odemo0000000001",
    orderNumber: "OO-1042",
    amount: 8750,
    paidToDate: 5000,
    balanceDue: 3750,
    statusSf: "Verified - Work Started",
    placedAt: "2026-05-02",
    advisorName: "Rinkie S.",
    paymentMethod: "Wire Transfer",
    shelfCorp: {
      id: "a0Cdemo0000000001",
      name: "2016 Wyoming LLC",
      entityType: "LLC",
      stateOfFormation: "Wyoming",
      incorporationDate: "2016-03-15",
      agedYears: 8,
      price: 8750,
      duns: "07-891-2345",
      creditReadyFeatures: [
        "Business address",
        "Business phone",
        "411 directory listing",
        "D-U-N-S number",
      ],
    },
    clientId: "a0Fdemo0000000001",
  },
  payments: [
    {
      id: "a0Pdemo0000000001",
      orderId: "a0Odemo0000000001",
      amount: 2500,
      method: "Wire Transfer",
      statusSf: "Cleared",
      isVerified: true,
      statusDate: "2026-05-08T16:40:00.000Z",
    },
    {
      id: "a0Pdemo0000000002",
      orderId: "a0Odemo0000000001",
      amount: 2500,
      method: "Credit Card",
      statusSf: "Cleared",
      isVerified: true,
      statusDate: "2026-05-03T10:00:00.000Z",
    },
  ],
};

export class MockPortalRepository implements PortalRepository {
  getDashboardByEmail(email: string): Promise<OrderDashboard | null> {
    return Promise.resolve(email === DEMO_EMAIL ? DEMO_DASHBOARD : null);
  }
}

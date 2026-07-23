import type { Client, Order, OrderDashboard, OrderDetail, OrdersList, Payment } from "@wsc/shared";
import type { ClientIdentity, PortalRepository } from "../../application/ports/portal-repository.js";

/**
 * In-memory adapter for the demo. The data has the EXACT shape the Salesforce adapter
 * returns (fields mapped from FU_User__c / Online_Order__c / Online_Payment__c /
 * SC_Corp__c — see docs/salesforce-data-model.md), so switching to live Salesforce is a
 * one-line change in the composition root. Mirrors the sandbox's real two orders
 * (UO1423102, UO1423103) for the same demo client.
 */
const DEMO_EMAIL = "m.brown@acmeholdings.com";

const DEMO_CLIENT: Client = {
  id: "a0Fdemo0000000001",
  email: DEMO_EMAIL,
  name: "Marcus Brown",
  phone: "+1 (305) 555-0148",
  businessName: "Acme Holdings LLC",
};

const DEMO_ORDERS: Order[] = [
  {
    id: "a0Odemo0000000002",
    orderNumber: "UO1423103",
    amount: 6200,
    paidToDate: 0,
    balanceDue: 6200,
    statusSf: "Pending Balance",
    placedAt: "2026-07-20",
    advisorName: "Rinkie S.",
    paymentMethod: "Credit Card",
    shelfCorp: null,
    clientId: DEMO_CLIENT.id,
  },
  {
    id: "a0Odemo0000000001",
    orderNumber: "UO1423102",
    amount: 8750,
    paidToDate: 8750,
    balanceDue: 0,
    statusSf: "Verified - Initial Contact",
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
    clientId: DEMO_CLIENT.id,
  },
];

const DEMO_PAYMENTS_BY_ORDER: Record<string, Payment[]> = {
  "a0Odemo0000000001": [
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
      amount: 6250,
      method: "Credit Card",
      statusSf: "Cleared",
      isVerified: true,
      statusDate: "2026-05-03T10:00:00.000Z",
    },
  ],
  "a0Odemo0000000002": [],
};

export class MockPortalRepository implements PortalRepository {
  getDashboardByEmail(email: string): Promise<OrderDashboard | null> {
    if (email !== DEMO_EMAIL) {
      return Promise.resolve(null);
    }
    const order = DEMO_ORDERS[0];
    if (!order) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ client: DEMO_CLIENT, order, payments: DEMO_PAYMENTS_BY_ORDER[order.id] ?? [] });
  }

  listOrdersByEmail(email: string): Promise<OrdersList | null> {
    if (email !== DEMO_EMAIL) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ client: DEMO_CLIENT, orders: DEMO_ORDERS });
  }

  getOrderByEmailAndId(email: string, orderId: string): Promise<OrderDetail | null> {
    if (email !== DEMO_EMAIL) {
      return Promise.resolve(null);
    }
    const order = DEMO_ORDERS.find((candidate) => candidate.id === orderId);
    if (!order) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ client: DEMO_CLIENT, order, payments: DEMO_PAYMENTS_BY_ORDER[order.id] ?? [] });
  }

  findClientByEmail(email: string): Promise<ClientIdentity | null> {
    if (email !== DEMO_EMAIL) {
      return Promise.resolve(null);
    }
    const { id, email: clientEmail, name } = DEMO_CLIENT;
    return Promise.resolve({ id, email: clientEmail, name });
  }
}

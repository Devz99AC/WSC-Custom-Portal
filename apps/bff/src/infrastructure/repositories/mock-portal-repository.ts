import type {
  Client,
  DocumentsList,
  Order,
  OrderDetail,
  OrdersList,
  Payment,
  PaymentsList,
  PortalDocument,
} from "@wsc/shared";
import type {
  ClientIdentity,
  DocumentDownload,
  PortalRepository,
} from "../../application/ports/portal-repository.js";

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

const DEMO_ADVISOR = {
  role: "advisor",
  name: "Rinkie S.",
  email: "rinkie@wholesaleshelfcorporations.com",
  phone: "+1 (720) 534-2065",
  whatsAppNumber: "+1 (720) 534-2065",
} as const;

// Real WSC support people (seen in production's Quality Control section on a live order).
const DEMO_SUPPORT_MANAGER = {
  role: "support-manager",
  name: "Lua Espluga",
  email: "lua@wholesaleshelfcorporations.com",
  phone: "(720) 598-0685",
  whatsAppNumber: "(720) 598-0685",
} as const;

const DEMO_BACKEND_SUPPORT = {
  role: "backend-support",
  name: "Rinki Gurjar",
  email: "rinki@wholesaleshelfcorporations.com",
  phone: "+1 (720) 534-2067",
  whatsAppNumber: "+1 (720) 534-2067",
} as const;

const DEMO_ORDERS: Order[] = [
  {
    id: "a0Odemo0000000002",
    orderNumber: "UO1423103",
    amount: 6200,
    paidToDate: 0,
    balanceDue: 6200,
    statusSf: "Pending Balance",
    statusUpdatedAt: "2026-07-20T14:05:00.000Z",
    onHoldReason: null,
    placedAt: "2026-07-20",
    fullyPaidAt: null,
    initialContactAt: null,
    completedAt: null,
    // Still pre-payment: the advisor owns this one, support hasn't taken over yet.
    advisor: DEMO_ADVISOR,
    supportManager: null,
    backEndSupport: null,
    paymentMethod: "Credit Card",
    paymentFrequency: "One-Time",
    ein: null,
    einIssuedAt: null,
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
    statusUpdatedAt: "2026-05-19T12:36:00.000Z",
    onHoldReason: null,
    placedAt: "2026-05-02",
    fullyPaidAt: "2026-05-08",
    initialContactAt: "2026-05-19",
    completedAt: null,
    advisor: DEMO_ADVISOR,
    supportManager: DEMO_SUPPORT_MANAGER,
    backEndSupport: DEMO_BACKEND_SUPPORT,
    paymentMethod: "Wire Transfer",
    paymentFrequency: "One-Time",
    ein: "88-1234567",
    einIssuedAt: "2026-05-14",
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
      corpNumber: "SCC415386",
      registrationNumber: "2016-000123456",
      creditScore: "80 Paydex",
      fundingCapacity: 250000,
      lastAnnualReportDate: "2026-01-15",
      nextRenewalDate: "2027-01-15",
      registeredAgentStatus: "Active - Initial Free Period",
    },
    clientId: DEMO_CLIENT.id,
  },
];

const DEMO_PAYMENTS_BY_ORDER: Record<string, Payment[]> = {
  "a0Odemo0000000001": [
    {
      id: "a0Pdemo0000000001",
      orderId: "a0Odemo0000000001",
      orderNumber: "UO1423102",
      productName: "2016 Wyoming LLC",
      amount: 2500,
      method: "Wire Transfer",
      statusSf: "Cleared",
      isVerified: true,
      statusDate: "2026-05-08T16:40:00.000Z",
    },
    {
      id: "a0Pdemo0000000002",
      orderId: "a0Odemo0000000001",
      orderNumber: "UO1423102",
      productName: "2016 Wyoming LLC",
      amount: 6250,
      method: "Credit Card",
      statusSf: "Cleared",
      isVerified: true,
      statusDate: "2026-05-03T10:00:00.000Z",
    },
  ],
  "a0Odemo0000000002": [],
};

/** Mirrors the real model: attachments hang off the ORDER, filed under that order's corp. */
const DEMO_DOCUMENTS: PortalDocument[] = [
  {
    id: "00Pdemo0000000001",
    name: "Articles of Organization - 2016 Wyoming LLC.pdf",
    contentType: "application/pdf",
    sizeBytes: 148_204,
    description: "Filed formation document issued by the Wyoming Secretary of State.",
    sharedAt: "2026-05-10T15:12:00.000Z",
    shelfCorpId: "a0Cdemo0000000001",
    orderId: "a0Odemo0000000001",
    orderNumber: "UO1423102",
  },
  {
    id: "00Pdemo0000000002",
    name: "EIN Confirmation Letter (CP-575).pdf",
    contentType: "application/pdf",
    sizeBytes: 96_130,
    description: "IRS notice confirming the entity's Employer Identification Number.",
    sharedAt: "2026-05-14T09:41:00.000Z",
    shelfCorpId: "a0Cdemo0000000001",
    orderId: "a0Odemo0000000001",
    orderNumber: "UO1423102",
  },
];

/** Demo mode has no document vault behind it — the bytes are a readable stand-in rather
 *  than a fake PDF that would fail to open. */
const DEMO_BODY = Buffer.from(
  "This is demo data. Connect the portal to Salesforce to download the real document.\n",
  "utf8",
);

export class MockPortalRepository implements PortalRepository {
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

  listPaymentsByEmail(email: string): Promise<PaymentsList | null> {
    if (email !== DEMO_EMAIL) {
      return Promise.resolve(null);
    }
    const payments = DEMO_ORDERS.flatMap((order) => DEMO_PAYMENTS_BY_ORDER[order.id] ?? []);
    return Promise.resolve({ payments });
  }

  listDocumentsByEmail(email: string): Promise<DocumentsList | null> {
    if (email !== DEMO_EMAIL) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ documents: DEMO_DOCUMENTS });
  }

  getDocumentForDownload(email: string, documentId: string): Promise<DocumentDownload | null> {
    if (email !== DEMO_EMAIL) {
      return Promise.resolve(null);
    }
    const document = DEMO_DOCUMENTS.find((candidate) => candidate.id === documentId);
    return Promise.resolve(document ? { document, body: DEMO_BODY } : null);
  }

  findClientByEmail(email: string): Promise<ClientIdentity | null> {
    if (email !== DEMO_EMAIL) {
      return Promise.resolve(null);
    }
    const { id, email: clientEmail, name } = DEMO_CLIENT;
    return Promise.resolve({ id, email: clientEmail, name });
  }
}

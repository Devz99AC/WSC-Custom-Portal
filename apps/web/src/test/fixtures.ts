import type {
  Client,
  Order,
  Payment,
  PortalDocument,
  ShelfCorp,
  StaffContact,
  StaffRole,
} from "@wsc/shared";

/**
 * Canonical test payloads, typed against the domain entities.
 *
 * The pages parse every API response with zod, so a fixture that drifts from the DTO
 * fails at runtime rather than at compile time — and hand-written literals in each test
 * file meant one widened DTO broke seven files at once. Building them here, typed, moves
 * that break to a single place: add the field once and every test stays valid.
 *
 * Mirrors the sandbox's demo client (Marcus Brown, orders UO1423102 / UO1423103).
 */

export const TEST_CLIENT: Client = {
  id: "c1",
  email: "m.brown@acmeholdings.com",
  name: "Marcus Brown",
  phone: null,
  businessName: "Acme Holdings LLC",
};

export const makeStaff = (
  role: StaffRole,
  overrides: Partial<StaffContact> = {},
): StaffContact => ({
  role,
  name: "Scott Benon",
  email: "scott@wholesaleshelfcorporations.com",
  phone: "+1 (720) 534-2065",
  whatsAppNumber: "+1 (720) 534-2065",
  ...overrides,
});

export const makeShelfCorp = (overrides: Partial<ShelfCorp> = {}): ShelfCorp => ({
  id: "s1",
  name: "2016 Wyoming LLC",
  entityType: "LLC",
  stateOfFormation: "Wyoming",
  incorporationDate: "2016-03-15",
  agedYears: 8,
  price: 8750,
  duns: "07-891-2345",
  creditReadyFeatures: [],
  corpNumber: "SCC415386",
  registrationNumber: null,
  lastAnnualReportDate: "2026-01-15",
  nextRenewalDate: "2027-01-15",
  registeredAgentStatus: "Active - Initial Free Period",
  ...overrides,
});

/** Defaults to the fully-paid order that has a shelf corp assigned (UO1423102) — the
 *  richer case. Override `shelfCorp: null` for the still-unpaid UO1423103 shape. */
export const makeOrder = (overrides: Partial<Order> = {}): Order => ({
  id: "o2",
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
  // Real WSC people, as they appear on a live order in production.
  advisor: makeStaff("advisor", { name: "Scott Benon" }),
  supportManager: makeStaff("support-manager", { name: "Lua Espluga" }),
  backEndSupport: makeStaff("backend-support", { name: "Rinki Gurjar" }),
  paymentMethod: "Wire Transfer",
  paymentFrequency: "One-Time",
  ein: "88-1234567",
  shelfCorp: makeShelfCorp(),
  clientId: TEST_CLIENT.id,
  ...overrides,
});

/** The unpaid order the sandbox also carries — no shelf corp assigned yet. */
export const makePendingOrder = (overrides: Partial<Order> = {}): Order =>
  makeOrder({
    id: "o1",
    orderNumber: "UO1423103",
    amount: 6200,
    paidToDate: 0,
    balanceDue: 6200,
    statusSf: "Pending Balance",
    statusUpdatedAt: "2026-07-20T14:05:00.000Z",
    placedAt: "2026-07-20",
    fullyPaidAt: null,
    initialContactAt: null,
    completedAt: null,
    paymentMethod: "Credit Card",
    ein: null,
    shelfCorp: null,
    ...overrides,
  });

/** An attachment on the paid order, filed under that order's corp — the real model:
 *  documents always hang off `Online_Order__c`, never off the corp. */
export const makeDocument = (overrides: Partial<PortalDocument> = {}): PortalDocument => ({
  id: "00P1",
  name: "Articles of Organization.pdf",
  contentType: "application/pdf",
  sizeBytes: 148_204,
  description: "Filed formation document.",
  sharedAt: "2026-05-10T15:12:00.000Z",
  shelfCorpId: "s1",
  orderId: "o2",
  orderNumber: "UO1423102",
  ...overrides,
});

export const makePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: "p1",
  orderId: "o2",
  orderNumber: "UO1423102",
  productName: "2016 Wyoming LLC",
  amount: 6750,
  method: "Wire Transfer",
  statusSf: "Cleared",
  isVerified: true,
  statusDate: "2026-07-19T12:36:26.000Z",
  ...overrides,
});

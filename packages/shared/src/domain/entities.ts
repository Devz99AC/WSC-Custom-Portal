/**
 * Portal domain DTOs, mapped to the REAL Salesforce objects discovered in the org
 * (see docs/salesforce-data-model.md). These are the thin *portal* shapes — the
 * Salesforce adapter converts the fat SF records (Online_Order__c has 698 fields) into
 * these at the boundary; raw SF field names never leak upward (CLAUDE.md §2).
 */

/** This portal is scoped to a single brand within the multi-brand CRM. */
export const PORTAL_BRAND = "WSC" as const;
export type Brand = typeof PORTAL_BRAND;

/** The customer — Salesforce `FU_User__c`. Identity resolved by email (magic-link). */
export interface Client {
  id: string; // FU_User__c.Id
  email: string; // E_Mail__c
  name: string; // Name
  phone: string | null; // Phone__c / Cell_Phone__c
  businessName: string | null; // Legal_Name_of_Business__c / Trade_Name__c
}

export type ShelfCorpStatus = "Available" | "Reserved" | "Sold";

/** The shelf corporation product — Salesforce `SC_Corp__c`.
 *
 *  Deliberately a small subset of the object: `SC_Corp__c` also carries WSC's own
 *  commercial data (`Invested_Amount__c`, `Payback_*`, `Reseller_*`, `Total_Revenues_*`,
 *  `Incorporation_Cost__c`) and operational credentials (`WP_Login__c`/`WP_Password__c`,
 *  `Secret_Code__c`). None of that belongs in a client-facing DTO — only fields the buyer
 *  legitimately needs about the corp they own are mapped here. */
export interface ShelfCorp {
  id: string; // SC_Corp__c.Id
  name: string; // Corp_Name / Name
  entityType: string; // Type__c (e.g. "Wyoming LLC")
  stateOfFormation: string; // Jurisdiction__c
  incorporationDate: string | null; // Incorporation_Date__c (ISO-8601)
  agedYears: number; // Age__c
  price: number | null; // Client_Price__c
  duns: string | null; // DUNS__c
  creditReadyFeatures: string[]; // derived from Paid_Features_Selected__c
  corpNumber: string | null; // Corp__c — WSC's corp reference (e.g. "SCC415386")
  registrationNumber: string | null; // Registration__c — state filing number
  creditScore: string | null; // Credit_Score__c (free text, e.g. "80 Paydex")
  fundingCapacity: number | null; // Funding_Capacity__c — credit the corp can support
  lastAnnualReportDate: string | null; // Last_Annual_Report__c (ISO-8601)
  nextRenewalDate: string | null; // Next_Annual_Report__c — "Next Renewal Date" (ISO-8601)
  registeredAgentStatus: string | null; // RA_Status__c
}

/**
 * The three WSC people a client deals with, in the order they appear (stakeholder,
 * 2026-07-28). All three are lookups from `Online_Order__c` to the SAME object,
 * `SEOX3_Team_Member__c`:
 *
 * | Role                | Lookup                |
 * | ------------------- | --------------------- |
 * | `advisor`           | `Sales_Rep__c`        |
 * | `support-manager`   | `QC_Agent__c`         |
 * | `backend-support`   | `Back_End_Worker__c`  |
 *
 * The advisor owns the relationship **until the sale closes**; from payment onward the
 * client talks to the two support roles instead. `staffForOrder()` encodes that hand-off.
 */
export type StaffRole = "advisor" | "support-manager" | "backend-support";

export interface StaffContact {
  role: StaffRole;
  name: string;
  email: string | null; // WSC_EMail__c, falling back to Corporate_E_Mail__c
  phone: string | null; // Corporate_Phone__c
  whatsAppNumber: string | null; // What_s_App__c (raw; see whatsAppLink())
}

/** Client-facing label for a staff role — data, never hardcoded in components. */
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  advisor: "Sales Advisor",
  "support-manager": "Support Manager",
  "backend-support": "Back-End Support",
};

/**
 * `wa.me` deep link from a stored phone number. Salesforce stores these as free-form
 * phone text (`+1 (720) 534-2065`, `720-658-0593`…), and wa.me accepts digits only, so
 * everything else is stripped. Returns null when nothing usable is left, rather than
 * producing a link that opens WhatsApp on a broken number.
 */
export function whatsAppLink(rawNumber: string | null): string | null {
  if (!rawNumber) {
    return null;
  }
  const digits = rawNumber.replace(/\D/g, "");
  return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}

export type PaymentMethod =
  | "Credit Card"
  | "Wire Transfer"
  | "ACH"
  | "PayPal"
  | "BTC"
  | "Other";

/** `Online_Payment__c.Status__c` values that mean the money is confirmed. */
export const VERIFIED_PAYMENT_STATUSES = ["Cleared", "Paid"] as const;

/** A single payment — Salesforce `Online_Payment__c`. */
export interface Payment {
  id: string; // Online_Payment__c.Id
  orderId: string; // Online_Order__c
  orderNumber: string; // Online_Order__c.Name — which order this belongs to (cross-order views)
  productName: string | null; // Online_Order__c.Corp__r.Name — which product this belongs to (null if no corp assigned to the order yet)
  amount: number; // Amount__c
  method: PaymentMethod; // Payment_Method__c
  statusSf: string; // Status__c (raw SF value)
  isVerified: boolean; // derived: Status__c ∈ VERIFIED_PAYMENT_STATUSES
  statusDate: string | null; // Status_Date__c (ISO-8601)
}

/** A client's order — Salesforce `Online_Order__c` (filtered `Brand__c = 'WSC'`). */
export interface Order {
  id: string; // Online_Order__c.Id
  orderNumber: string; // Name (autonumber)
  amount: number; // Amount__c
  paidToDate: number; // Total_Payments__c
  balanceDue: number; // Amount__c − Total_Payments__c (derived)
  statusSf: string; // Status__c (raw SF value; interpret via orderStage* helpers)
  statusUpdatedAt: string | null; // Status_Date__c — when the stage last moved (ISO-8601)
  onHoldReason: string | null; // On_Hold_Reason__c — only meaningful while ON HOLD - *
  placedAt: string | null; // Order_Date__c (ISO-8601)
  fullyPaidAt: string | null; // Fully_Paid_Date__c — when the balance reached zero (ISO-8601)
  /** Stage timestamps. Salesforce overwrites `Status__c` when an order is put ON HOLD, so
   *  these are the only way to know how far a paused order actually got — see
   *  `orderProgress()` in domain/order-stage.ts. */
  initialContactAt: string | null; // TimeStamp_Verified_IC__c
  completedAt: string | null; // TimeStamp_Verified_Complete__c
  advisor: StaffContact | null; // Sales_Rep__c → SEOX3_Team_Member__c (name falls back to SR_Name__c)
  supportManager: StaffContact | null; // QC_Agent__c → SEOX3_Team_Member__c
  backEndSupport: StaffContact | null; // Back_End_Worker__c → SEOX3_Team_Member__c
  paymentMethod: PaymentMethod | null; // Payment_Method__c
  paymentFrequency: string | null; // Payment_Frequency__c (e.g. "One-Time")
  /** The corp's federal tax ID — `EIN__c`, formatted `XX-XXXXXXX` from the raw SF number.
   *  Sensitive PII (CLAUDE.md §3): it reaches the client only because row-level authz
   *  guarantees this is their OWN order, it is never logged, and the UI keeps it masked
   *  behind an explicit reveal. Do not add it to list endpoints or to any log line. */
  ein: string | null;
  einIssuedAt: string | null; // EIN_Date_Issued__c (ISO-8601)
  shelfCorp: ShelfCorp | null; // Corp__c → SC_Corp__c
  clientId: string; // Client__c → FU_User__c
}

/** Aggregate returned by the order-detail endpoint — one specific order + its payments. */
export interface OrderDetail {
  client: Client;
  order: Order;
  payments: Payment[];
}

/** Aggregate returned by the "My Orders" list endpoint. */
export interface OrdersList {
  client: Client;
  orders: Order[];
}

/** Aggregate returned by the cross-order payments endpoint — every payment across every
 *  one of the client's orders (not scoped to a single order, unlike OrderDetail.payments). */
export interface PaymentsList {
  payments: Payment[];
}

/**
 * A file shared with the client — Salesforce's classic `Attachment`, i.e. the
 * "Notes & Attachments" related list. Deliberately NOT `ContentDocument`/Salesforce
 * Files: the stakeholder confirmed Notes & Attachments is where WSC's client paperwork
 * actually lives (docs/salesforce-data-model.md).
 *
 * **Documents always hang off `Online_Order__c`, never off the corp** (stakeholder,
 * 2026-07-28). The portal still presents them under the *product* the client
 * recognizes, so the adapter resolves the parent order's `Corp__c` into `shelfCorpId` —
 * that mapping is the only reason this field exists. An order with no corp assigned yet
 * keeps `shelfCorpId: null` so its files stay reachable instead of vanishing.
 */
export interface PortalDocument {
  id: string; // Attachment.Id
  name: string; // Attachment.Name (includes the file extension)
  contentType: string | null; // Attachment.ContentType
  sizeBytes: number; // Attachment.BodyLength
  description: string | null; // Attachment.Description
  sharedAt: string | null; // Attachment.CreatedDate (ISO-8601)
  shelfCorpId: string | null; // parent order's Corp__c — the product this is filed under
  orderId: string; // Attachment.ParentId — always an Online_Order__c
  orderNumber: string;
}

/** Aggregate returned by the documents endpoint — every document across all of the
 *  client's orders and their shelf corps. */
export interface DocumentsList {
  documents: PortalDocument[];
}

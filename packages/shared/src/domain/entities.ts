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

/** The shelf corporation product — Salesforce `SC_Corp__c`. */
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
  placedAt: string | null; // Order_Date__c (ISO-8601)
  advisorName: string | null; // SR_Name__c / Sales_Rep__c.Name
  paymentMethod: PaymentMethod | null; // Payment_Method__c
  shelfCorp: ShelfCorp | null; // Corp__c → SC_Corp__c
  clientId: string; // Client__c → FU_User__c
}

/** Aggregate returned by the dashboard endpoint. */
export interface OrderDashboard {
  client: Client;
  order: Order;
  payments: Payment[];
}

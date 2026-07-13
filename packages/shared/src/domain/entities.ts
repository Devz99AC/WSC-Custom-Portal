import type { OrderStage } from "./order-stage.js";

/**
 * Core domain DTOs shared between the BFF and the SPA.
 *
 * These are the *portal* shapes, not raw Salesforce records. Adapters convert SF
 * payloads into these at the boundary; vendor field names never leak upward
 * (CLAUDE.md §2). Naming follows the glossary in CLAUDE.md §3. No behaviour lives
 * here in Phase 0 — types only.
 */

/** `Shelf_Corp__c.Status__c` — a unit is serialized and sells exactly once. */
export type ShelfCorpStatus = "Available" | "Reserved" | "Sold";

/** A serialized shelf corporation (Salesforce `Shelf_Corp__c`) — the product. */
export interface ShelfCorp {
  id: string;
  entityType: string; // Entity_Type__c, e.g. "Wyoming LLC"
  stateOfFormation: string; // State_of_Formation__c
  yearEstablished: number; // Year_Established__c
  agedYears: number; // Time_In_Business__c
  isInGoodStanding: boolean; // Good_Standing__c
  creditReadyFeatures: number; // Credit_Ready_Features__c (count)
  status: ShelfCorpStatus; // Status__c
  /** EIN__c — sensitive PII; masked to the last 2 digits in DTOs (CLAUDE.md §3). */
  einMasked: string;
}

/** A client's purchase engagement — Salesforce `Opportunity` (`OO-####`). */
export interface Order {
  id: string;
  orderNumber: string; // e.g. "OO-1042"
  amount: number;
  balanceDue: number; // Amount − sum(verified Payments)
  stage: OrderStage;
  advisor: string | null; // Assigned_Advisor__c display name
  shelfCorpId: string;
}

export type PaymentMethod = "Card" | "Wire";
export type PaymentStatus = "Pending" | "Verified" | "Failed" | "Refunded";

/** A single installment / transaction (Salesforce `Payment__c`). */
export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  verifiedAt: string | null; // ISO-8601
}

export type DocumentType =
  | "Purchase Agreement"
  | "Articles of Incorporation"
  | "EIN Letter";

/** Metadata + storage pointer for a vault document (Salesforce `Document__c`). */
export interface DocumentMeta {
  id: string;
  orderId: string;
  type: DocumentType;
  fileSizeBytes: number;
  uploadedAt: string; // ISO-8601
  isClientVisible: boolean; // Is_Client_Visible__c
}

import type { DocumentsList, OrderDetail, OrdersList, PaymentsList, PortalDocument } from "@wsc/shared";

/** Minimal identity resolved from an email — enough to key a session, not a full profile. */
export interface ClientIdentity {
  id: string;
  email: string;
  name: string;
}

/** An attachment's metadata plus its bytes, ready for the BFF to stream back. */
export interface DocumentDownload {
  document: PortalDocument;
  body: Buffer;
}

/**
 * Port (hexagonal) for reading a client's portal data. The domain/use-cases depend on
 * this interface only; concrete adapters live in infrastructure/ — a mock now, the real
 * Salesforce adapter (reading FU_User__c / Online_Order__c / Online_Payment__c behind
 * JWT Bearer) later. Swapping the data source touches only the composition root.
 */
export interface PortalRepository {
  /** All of the customer's orders, newest first. Null only if the email doesn't resolve
   *  to a known client (used to distinguish "no client" from "client, zero orders"). */
  listOrdersByEmail(email: string): Promise<OrdersList | null>;

  /** One order, scoped to the requesting client's own email (row-level authz — a client
   *  must never be able to fetch another client's order by guessing its id). Null if no
   *  such order exists for this email. */
  getOrderByEmailAndId(email: string, orderId: string): Promise<OrderDetail | null>;

  /** Every payment across every one of the client's orders (cross-order aggregate for
   *  the Payments nav section). Null only if the email doesn't resolve to a known client. */
  listPaymentsByEmail(email: string): Promise<PaymentsList | null>;

  /** Every document (Salesforce `Attachment`) hanging off the client's orders and their
   *  shelf corps. Null only if the email doesn't resolve to a known client. */
  listDocumentsByEmail(email: string): Promise<DocumentsList | null>;

  /**
   * One document's bytes, scoped to the requesting client's own email. The id alone must
   * never be enough to read a file — implementations re-derive the client's own document
   * set and refuse anything outside it, so a guessed Attachment id returns null.
   */
  getDocumentForDownload(email: string, documentId: string): Promise<DocumentDownload | null>;

  /**
   * Resolve `email → FU_User__c` identity for the magic-link flow (ADR-0005). Returns
   * null for an unknown email — callers must NOT let that distinction leak to the
   * client response (anti-enumeration, ARCHITECTURE.md §3.2).
   */
  findClientByEmail(email: string): Promise<ClientIdentity | null>;
}

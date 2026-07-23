import type { OrderDashboard, OrderDetail, OrdersList } from "@wsc/shared";

/** Minimal identity resolved from an email — enough to key a session, not a full profile. */
export interface ClientIdentity {
  id: string;
  email: string;
  name: string;
}

/**
 * Port (hexagonal) for reading a client's portal data. The domain/use-cases depend on
 * this interface only; concrete adapters live in infrastructure/ — a mock now, the real
 * Salesforce adapter (reading FU_User__c / Online_Order__c / Online_Payment__c behind
 * JWT Bearer) later. Swapping the data source touches only the composition root.
 */
export interface PortalRepository {
  /** Resolve the dashboard (most recent order) for the customer identified by email;
   *  null if the client has no orders at all. */
  getDashboardByEmail(email: string): Promise<OrderDashboard | null>;

  /** All of the customer's orders, newest first. Null only if the email doesn't resolve
   *  to a known client (used to distinguish "no client" from "client, zero orders"). */
  listOrdersByEmail(email: string): Promise<OrdersList | null>;

  /** One order, scoped to the requesting client's own email (row-level authz — a client
   *  must never be able to fetch another client's order by guessing its id). Null if no
   *  such order exists for this email. */
  getOrderByEmailAndId(email: string, orderId: string): Promise<OrderDetail | null>;

  /**
   * Resolve `email → FU_User__c` identity for the magic-link flow (ADR-0005). Returns
   * null for an unknown email — callers must NOT let that distinction leak to the
   * client response (anti-enumeration, ARCHITECTURE.md §3.2).
   */
  findClientByEmail(email: string): Promise<ClientIdentity | null>;
}

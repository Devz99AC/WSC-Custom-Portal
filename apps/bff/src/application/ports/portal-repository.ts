import type { OrderDashboard } from "@wsc/shared";

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
  /** Resolve the dashboard for the customer identified by email; null if none. */
  getDashboardByEmail(email: string): Promise<OrderDashboard | null>;

  /**
   * Resolve `email → FU_User__c` identity for the magic-link flow (ADR-0005). Returns
   * null for an unknown email — callers must NOT let that distinction leak to the
   * client response (anti-enumeration, ARCHITECTURE.md §3.2).
   */
  findClientByEmail(email: string): Promise<ClientIdentity | null>;
}

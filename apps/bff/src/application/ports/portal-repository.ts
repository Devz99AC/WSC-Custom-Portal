import type { OrderDashboard } from "@wsc/shared";

/**
 * Port (hexagonal) for reading a client's portal data. The domain/use-cases depend on
 * this interface only; concrete adapters live in infrastructure/ — a mock now, the real
 * Salesforce adapter (reading FU_User__c / Online_Order__c / Online_Payment__c behind
 * JWT Bearer) later. Swapping the data source touches only the composition root.
 */
export interface PortalRepository {
  /** Resolve the dashboard for the customer identified by email; null if none. */
  getDashboardByEmail(email: string): Promise<OrderDashboard | null>;
}

import type { OrderDashboard } from "@wsc/shared";
import type { PortalRepository } from "./ports/portal-repository.js";

/**
 * Use-case: fetch the authenticated customer's dashboard. Framework-free and
 * data-source-agnostic — it depends only on the PortalRepository port, so it can be
 * unit-tested against an in-memory fake (ROADMAP 2.2) and reused across adapters.
 */
export class GetDashboard {
  constructor(private readonly repository: PortalRepository) {}

  execute(email: string): Promise<OrderDashboard | null> {
    return this.repository.getDashboardByEmail(email.trim().toLowerCase());
  }
}

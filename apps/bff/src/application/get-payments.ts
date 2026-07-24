import type { PaymentsList } from "@wsc/shared";
import type { PortalRepository } from "./ports/portal-repository.js";

/** Use-case: every payment across every one of the authenticated customer's orders. */
export class GetPayments {
  constructor(private readonly repository: PortalRepository) {}

  execute(email: string): Promise<PaymentsList | null> {
    return this.repository.listPaymentsByEmail(email.trim().toLowerCase());
  }
}

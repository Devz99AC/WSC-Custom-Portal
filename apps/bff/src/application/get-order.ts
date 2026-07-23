import type { OrderDetail } from "@wsc/shared";
import type { PortalRepository } from "./ports/portal-repository.js";

/** Use-case: fetch one order's detail, scoped to the authenticated customer's own email. */
export class GetOrder {
  constructor(private readonly repository: PortalRepository) {}

  execute(email: string, orderId: string): Promise<OrderDetail | null> {
    return this.repository.getOrderByEmailAndId(email.trim().toLowerCase(), orderId);
  }
}

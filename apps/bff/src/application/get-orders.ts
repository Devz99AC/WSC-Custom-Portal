import type { OrdersList } from "@wsc/shared";
import type { PortalRepository } from "./ports/portal-repository.js";

/** Use-case: fetch the authenticated customer's full order list ("My Orders"). */
export class GetOrders {
  constructor(private readonly repository: PortalRepository) {}

  execute(email: string): Promise<OrdersList | null> {
    return this.repository.listOrdersByEmail(email.trim().toLowerCase());
  }
}

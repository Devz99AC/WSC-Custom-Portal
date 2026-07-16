import { orderDashboardSchema, type OrderDashboardDto } from "@wsc/shared";

/**
 * Typed BFF client. The response is validated with the shared zod schema at the
 * boundary, so the static types can't lie at runtime (CLAUDE.md §2). The SPA only ever
 * talks to the BFF — never to Salesforce directly.
 */
export async function fetchDashboard(email: string): Promise<OrderDashboardDto> {
  const response = await fetch(`/api/dashboard?email=${encodeURIComponent(email)}`);

  if (response.status === 404) {
    throw new Error("We couldn't find an order for that email.");
  }
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return orderDashboardSchema.parse(payload);
}

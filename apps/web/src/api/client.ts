import { orderDashboardSchema, type OrderDashboardDto } from "@wsc/shared";

/** Thrown on a 401 — the caller uses this to distinguish "not signed in" from a real error. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

/**
 * Typed BFF client. The response is validated with the shared zod schema at the
 * boundary, so the static types can't lie at runtime (CLAUDE.md §2). The SPA only ever
 * talks to the BFF — never to Salesforce directly. Identity comes from the session
 * cookie (ADR-0005) — no email/id is ever sent by the client to select whose data to read.
 */
export async function fetchDashboard(): Promise<OrderDashboardDto> {
  const response = await fetch("/api/dashboard");

  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (response.status === 404) {
    throw new Error("We couldn't find an order for this account.");
  }
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  return orderDashboardSchema.parse(payload);
}

/** Step 1 of the magic-link flow — always resolves, regardless of whether the email
 *  matched an account (anti-enumeration; the BFF response is intentionally generic). */
export async function requestMagicLink(email: string): Promise<void> {
  const response = await fetch("/auth/request-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }
}

export async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST" });
}

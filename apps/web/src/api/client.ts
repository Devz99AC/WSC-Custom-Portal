import {
  documentsListSchema,
  orderDetailSchema,
  ordersListSchema,
  paymentsListSchema,
  type DocumentsListDto,
  type OrderDetailDto,
  type OrdersListDto,
  type PaymentsListDto,
} from "@wsc/shared";

/** Thrown on a 401 — the caller uses this to distinguish "not signed in" from a real error. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

/**
 * Thrown when a response doesn't match the schema this bundle was built against.
 *
 * That is almost never a server fault. The SPA and the BFF deploy separately, so a tab
 * that was open — or restored with Ctrl+Shift+T — during a release is running JavaScript
 * older than the API it is calling, and a field the old schema still requires may already
 * be gone. Retrying cannot fix it; only fetching the new bundle can, which is why App.tsx
 * treats this one error by reloading rather than by displaying it.
 *
 * It exists as its own type because the alternative is what a client actually saw on
 * 2026-08-07: the raw `ZodError.message`, i.e. a JSON dump of internal field paths, on
 * screen (`[{"code":"invalid_type","path":["orders",0,"ein"]…}]`).
 */
export class OutdatedClientError extends Error {
  constructor() {
    super("The portal was updated while this tab was open. Refresh the page to continue.");
    this.name = "OutdatedClientError";
  }
}

/** Long enough for a slow Salesforce read, short enough that a stuck request eventually
 *  becomes a visible error instead of an eternal spinner. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Just enough of a zod schema to validate with. Declared structurally so the web app
 *  doesn't take a direct dependency on zod — schemas arrive through `@wsc/shared`. */
interface ResponseSchema<T> {
  safeParse(payload: unknown): { success: true; data: T } | { success: false };
}

/**
 * Typed BFF client. The response is validated with the shared zod schema at the
 * boundary, so the static types can't lie at runtime (CLAUDE.md §2). The SPA only ever
 * talks to the BFF — never to Salesforce directly. Identity comes from the session
 * cookie (ADR-0005) — no email/id is ever sent by the client to select whose data to read.
 *
 * Everything the four reads share lives here, most importantly the timeout: `fetch` has
 * none by default, so a request that never settles leaves TanStack Query permanently
 * `pending` and the app shows "Loading your portal…" with nothing to break the deadlock.
 */
async function getJson<T>(
  path: string,
  schema: ResponseSchema<T>,
  notFoundMessage: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    // `no-store` because these are per-client and carry the session cookie: neither the
    // browser nor an intermediary should ever reuse one response for another request.
    response = await fetch(path, { signal: controller.signal, cache: "no-store" });
  } catch {
    // Abort or offline. Either way the caller gets a finite, readable failure.
    throw new Error("We couldn't reach the portal. Check your connection and try again.");
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401) {
    throw new UnauthorizedError();
  }
  if (response.status === 404) {
    throw new Error(notFoundMessage);
  }
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }

  const payload: unknown = await response.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    // safeParse, not parse: a raw ZodError's `message` is a JSON blob of field paths, and
    // App.tsx renders `error.message` straight to the client.
    throw new OutdatedClientError();
  }
  return parsed.data;
}

/** "My Orders" — every order for the signed-in client, newest first. Also the app's
 *  top-level "who am I" fetch (auth gate + sidebar identity) — see App.tsx. */
export function fetchOrders(): Promise<OrdersListDto> {
  return getJson("/api/orders", ordersListSchema, "We couldn't find an account for this login.");
}

/** One order's detail, scoped server-side to the signed-in client (§ server.ts). */
export function fetchOrder(orderId: string): Promise<OrderDetailDto> {
  return getJson(
    `/api/orders/${encodeURIComponent(orderId)}`,
    orderDetailSchema,
    "We couldn't find that order.",
  );
}

/** "Payments" — every payment across every one of the signed-in client's orders. */
export function fetchPayments(): Promise<PaymentsListDto> {
  return getJson(
    "/api/payments",
    paymentsListSchema,
    "We couldn't find an account for this login.",
  );
}

/** "Documents" — every attachment on the signed-in client's orders, tagged with the
 *  product its order points at. */
export function fetchDocuments(): Promise<DocumentsListDto> {
  return getJson(
    "/api/documents",
    documentsListSchema,
    "We couldn't find an account for this login.",
  );
}

/** Download URL for one document. A plain same-origin link: the browser sends the
 *  session cookie and the BFF streams the bytes back, so no Salesforce URL or token
 *  ever reaches the page. */
export function documentDownloadUrl(documentId: string): string {
  return `/api/documents/${encodeURIComponent(documentId)}/download`;
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

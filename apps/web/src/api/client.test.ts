import { afterEach, describe, expect, it, vi } from "vitest";
import { OutdatedClientError, UnauthorizedError, fetchOrders, requestMagicLink } from "./client";
import { TEST_CLIENT, makeOrder } from "../test/fixtures";

const respondWith = (body: unknown, status = 200) =>
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })),
  );

const ordersPayload = () => ({ client: TEST_CLIENT, orders: [makeOrder()] });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("BFF client", () => {
  it("parses a well-formed response", async () => {
    respondWith(ordersPayload());
    await expect(fetchOrders()).resolves.toMatchObject({ client: TEST_CLIENT });
  });

  it("maps a 401 to UnauthorizedError so App can show the login screen", async () => {
    respondWith({ error: "Not signed in" }, 401);
    await expect(fetchOrders()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  /**
   * The 2026-08-07 incident: a client's tab, restored with Ctrl+Shift+T, was running a
   * bundle built before `ein`/`price`/`corpNumber`/`registeredAgentStatus` came off the
   * DTO. The BFF had already stopped sending them, so the old schema rejected the payload
   * and the screen showed the raw ZodError — a JSON dump of internal field paths.
   */
  it("turns a schema mismatch into OutdatedClientError, never a raw ZodError", async () => {
    // Exactly the shape the deployed API now returns to that old bundle: an order with a
    // field the schema still marks required simply absent.
    const { shelfCorp: _dropped, ...orderMissingAField } = makeOrder();
    respondWith({ client: TEST_CLIENT, orders: [orderMissingAField] });

    const failure = await fetchOrders().catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(OutdatedClientError);
    expect((failure as Error).message).not.toContain("invalid_type");
    expect((failure as Error).message).not.toContain("shelfCorp");
  });

  /**
   * `fetch` has no default timeout, so a request that never settles left TanStack Query
   * `pending` forever and the app sat on "Loading your portal…" with nothing to break the
   * deadlock. Every request now carries an abort signal.
   */
  it("aborts a request that never settles instead of hanging the app", async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        "fetch",
        vi.fn(
          (_path: string, init?: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () =>
                reject(new DOMException("Aborted", "AbortError")),
              );
            }),
        ),
      );

      const pending = fetchOrders();
      const settled = vi.fn();
      void pending.catch(settled);

      await vi.advanceTimersByTimeAsync(29_000);
      expect(settled).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(2_000);
      await expect(pending).rejects.toThrow(/couldn't reach the portal/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("asks the browser not to store a response scoped to one client", async () => {
    respondWith(ordersPayload());
    await fetchOrders();

    expect(fetch).toHaveBeenCalledWith(
      "/api/orders",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});

/**
 * The login screen tells a visitor whether their email has portal access (stakeholder
 * decision 2026-08-08). requestMagicLink surfaces the BFF's `status` so Login can render
 * "check your email" vs "no access".
 */
describe("requestMagicLink", () => {
  it("reports 'sent' when the BFF grants access", async () => {
    respondWith({ status: "sent", message: "on its way" });
    await expect(requestMagicLink("m.brown@acmeholdings.com")).resolves.toBe("sent");
  });

  it("reports 'denied' when the email has no active order", async () => {
    respondWith({ status: "denied", message: "no access" });
    await expect(requestMagicLink("stranger@example.com")).resolves.toBe("denied");
  });

  it("defaults to 'sent' for an unexpected body, never a false 'no access'", async () => {
    respondWith({});
    await expect(requestMagicLink("someone@example.com")).resolves.toBe("sent");
  });
});

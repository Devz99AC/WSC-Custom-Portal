import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_CLIENT, makeOrder, makePayment, makePendingOrder } from "../test/fixtures";
import { PaymentsPage } from "./PaymentsPage";

const ORDERS_RESPONSE = {
  client: TEST_CLIENT,
  orders: [makePendingOrder(), makeOrder({ shelfCorp: null })],
};

const PAYMENTS_RESPONSE = {
  payments: [makePayment()],
};

describe("PaymentsPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const body = url.includes("/api/payments") ? PAYMENTS_RESPONSE : ORDERS_RESPONSE;
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }),
    );
  });

  it("aggregates totals across orders and lists payments with their product and order", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PaymentsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("UO1423102")).toBeInTheDocument();
    });
    expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    // Total across both orders: 6200 + 8750 = 14950.
    expect(screen.getByText("$14,950")).toBeInTheDocument();
  });
});

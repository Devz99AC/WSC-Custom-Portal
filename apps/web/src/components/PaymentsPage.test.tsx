import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentsPage } from "./PaymentsPage";

const ORDERS_RESPONSE = {
  client: {
    id: "c1",
    email: "m.brown@acmeholdings.com",
    name: "Marcus Brown",
    phone: null,
    businessName: "Acme Holdings LLC",
  },
  orders: [
    {
      id: "o1",
      orderNumber: "UO1423103",
      amount: 6200,
      paidToDate: 0,
      balanceDue: 6200,
      statusSf: "Pending Balance",
      placedAt: "2026-07-20",
      advisorName: "Rinkie S.",
      paymentMethod: "Credit Card",
      shelfCorp: null,
      clientId: "c1",
    },
    {
      id: "o2",
      orderNumber: "UO1423102",
      amount: 8750,
      paidToDate: 8750,
      balanceDue: 0,
      statusSf: "Verified - Initial Contact",
      placedAt: "2026-05-02",
      advisorName: "Rinkie S.",
      paymentMethod: "Wire Transfer",
      shelfCorp: null,
      clientId: "c1",
    },
  ],
};

const PAYMENTS_RESPONSE = {
  payments: [
    {
      id: "p1",
      orderId: "o2",
      orderNumber: "UO1423102",
      productName: "2016 Wyoming LLC",
      amount: 6750,
      method: "Wire Transfer",
      statusSf: "Cleared",
      isVerified: true,
      statusDate: "2026-07-19T12:36:26.000Z",
    },
  ],
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

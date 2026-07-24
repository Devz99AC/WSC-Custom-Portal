import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./ProfilePage";

const ORDERS_RESPONSE = {
  client: {
    id: "c1",
    email: "m.brown@acmeholdings.com",
    name: "Marcus Brown",
    phone: "+1 (305) 555-0148",
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

describe("ProfilePage", () => {
  it("derives 'client since' from the earliest order across all orders", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(ORDERS_RESPONSE), { status: 200 })),
    );
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ProfilePage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("m.brown@acmeholdings.com")).toBeInTheDocument();
    });
    // Earliest placedAt is 2026-05-02 (UO1423102), not 2026-07-20 (UO1423103).
    expect(screen.getByText(/Client since May 2026/)).toBeInTheDocument();
  });
});

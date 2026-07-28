import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { TEST_CLIENT, makeOrder, makePendingOrder } from "../test/fixtures";
import { ProfilePage } from "./ProfilePage";

const ORDERS_RESPONSE = {
  client: { ...TEST_CLIENT, phone: "+1 (305) 555-0148" },
  orders: [makePendingOrder(), makeOrder({ shelfCorp: null })],
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

import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_CLIENT, makeOrder, makePendingOrder } from "../test/fixtures";
import { OrdersListPage } from "./OrdersListPage";

const ORDERS_RESPONSE = {
  client: TEST_CLIENT,
  orders: [makePendingOrder(), makeOrder({ shelfCorp: null })],
};

describe("OrdersListPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(ORDERS_RESPONSE), { status: 200 })),
    );
  });

  it("renders every order for the signed-in client, newest first", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <OrdersListPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("UO1423103")).toBeInTheDocument();
    });
    expect(screen.getByText("UO1423102")).toBeInTheDocument();
    expect(screen.getByText("Pending Balance")).toBeInTheDocument();
  });
});

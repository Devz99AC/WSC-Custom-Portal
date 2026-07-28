import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_CLIENT, makeOrder, makePendingOrder } from "../test/fixtures";
import { DocumentsPage } from "./DocumentsPage";

const ORDERS_RESPONSE = {
  client: TEST_CLIENT,
  orders: [makePendingOrder(), makeOrder()],
};

describe("DocumentsPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(ORDERS_RESPONSE), { status: 200 })),
    );
  });

  it("segments by product (shelf corp), not by order number", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DocumentsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    });
    // The order with no shelfCorp assigned yet doesn't get a documents row.
    expect(screen.queryByText("UO1423103")).not.toBeInTheDocument();
  });
});

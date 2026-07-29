import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_CLIENT, makeOrder, makePendingOrder } from "../test/fixtures";
import { OrdersListPage } from "./OrdersListPage";

const stubOrders = (orders: unknown[]) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ client: TEST_CLIENT, orders }), { status: 200 }),
    ),
  );
};

const renderPage = () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <OrdersListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("OrdersListPage", () => {
  beforeEach(() => {
    stubOrders([makePendingOrder(), makeOrder({ shelfCorp: null })]);
  });

  it("renders every order for the signed-in client, newest first", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("UO1423103")).toBeInTheDocument();
    });
    expect(screen.getByText("UO1423102")).toBeInTheDocument();
  });

  it("shows the client-facing step name, never the raw Salesforce status", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Unpaid")).toBeInTheDocument();
    });
    expect(screen.queryByText("Pending Balance")).not.toBeInTheDocument();
    expect(screen.getByText("Initial Onboarding Call")).toBeInTheDocument();
  });

  it("collapses every cancelled reason to a plain 'Cancelled'", async () => {
    stubOrders([makeOrder({ statusSf: "Cancelled - Chargeback Received" })]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
    // "Chargeback Received" is internal bookkeeping — never shown to the client.
    expect(screen.queryByText(/Chargeback/)).not.toBeInTheDocument();
  });

  it("shows a paused order as 'On hold'", async () => {
    stubOrders([makeOrder({ statusSf: "ON HOLD - Client's Unresponsive" })]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("On hold")).toBeInTheDocument();
    });
  });
});

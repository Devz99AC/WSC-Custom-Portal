import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentsPage } from "./DocumentsPage";

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
      shelfCorp: {
        id: "s1",
        name: "2016 Wyoming LLC",
        entityType: "LLC",
        stateOfFormation: "Wyoming",
        incorporationDate: "2016-03-15",
        agedYears: 8,
        price: 8750,
        duns: "07-891-2345",
        creditReadyFeatures: [],
      },
      clientId: "c1",
    },
  ],
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

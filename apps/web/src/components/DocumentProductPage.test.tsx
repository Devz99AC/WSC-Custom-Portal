import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentProductPage } from "./DocumentProductPage";

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

describe("DocumentProductPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(ORDERS_RESPONSE), { status: 200 })),
    );
  });

  it("resolves the product from the :corpId route param", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/documents/s1"]}>
          <Routes>
            <Route path="/documents/:corpId" element={<DocumentProductPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    });
    expect(screen.getByText(/No documents have been shared yet for 2016 Wyoming LLC/)).toBeInTheDocument();
  });
});

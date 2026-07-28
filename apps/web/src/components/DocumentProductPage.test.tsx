import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_CLIENT, makeOrder } from "../test/fixtures";
import { DocumentProductPage } from "./DocumentProductPage";

const ORDERS_RESPONSE = {
  client: TEST_CLIENT,
  orders: [makeOrder()],
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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_CLIENT, makeOrder, makeShelfCorp } from "../test/fixtures";
import { OrderPage } from "./OrderPage";

const respondWith = (order = makeOrder()) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ client: TEST_CLIENT, order, payments: [] }), { status: 200 }),
    ),
  );
};

const renderPage = async () => {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/orders/o2"]}>
        <Routes>
          <Route path="/orders/:id" element={<OrderPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await waitFor(() => {
    expect(screen.getByText("Order UO1423102")).toBeInTheDocument();
  });
};

describe("OrderPage", () => {
  beforeEach(() => {
    respondWith();
  });

  it("resolves the order from the :id route param and renders its detail", async () => {
    await renderPage();
    expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/orders/o2");
  });

  it("shows the corp and order detail fields that come straight from Salesforce", async () => {
    await renderPage();
    expect(screen.getByText("SCC415386")).toBeInTheDocument();
    expect(screen.getByText("Active - Initial Free Period")).toBeInTheDocument();
    expect(screen.getByText("One-Time")).toBeInTheDocument();
  });

  it("shows the incorporation date with the corp's age beside it", async () => {
    await renderPage();
    expect(screen.getByText("Incorporated")).toBeInTheDocument();
    expect(screen.getByText("March 15, 2016 (8 Years Old)")).toBeInTheDocument();
  });

  it("drops the age parenthetical rather than printing '0 Years Old'", async () => {
    respondWith(makeOrder({ shelfCorp: makeShelfCorp({ agedYears: 0 }) }));
    await renderPage();
    expect(screen.getByText("March 15, 2016")).toBeInTheDocument();
  });

  it("falls back to the age alone when Salesforce has no incorporation date", async () => {
    respondWith(makeOrder({ shelfCorp: makeShelfCorp({ incorporationDate: null }) }));
    await renderPage();
    expect(screen.getByText("(8 Years Old)")).toBeInTheDocument();
  });

  it("shows the corp name alone, without the entity-type/package blurb", async () => {
    await renderPage();
    expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    expect(screen.queryByText(/Credit-Ready package/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/8-year aged/)).not.toBeInTheDocument();
  });

  // Removed from the portal 2026-08-07 at the stakeholder's request. Asserted as absent
  // because these came off the DTO too — nothing should be able to put them back by
  // accident.
  it("never shows EIN issue date, credit score or funding capacity", async () => {
    await renderPage();
    expect(screen.queryByText("EIN issued")).not.toBeInTheDocument();
    expect(screen.queryByText("Credit score")).not.toBeInTheDocument();
    expect(screen.queryByText("Funding capacity")).not.toBeInTheDocument();
  });

  it("masks the EIN until the client explicitly reveals it", async () => {
    await renderPage();
    expect(screen.queryByText(/88-1234567/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText(/88-1234567/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide" }));
    expect(screen.queryByText(/88-1234567/)).not.toBeInTheDocument();
  });

  it("omits detail rows Salesforce hasn't filled in rather than showing em-dashes", async () => {
    respondWith(makeOrder({ ein: null, fullyPaidAt: null }));
    await renderPage();
    expect(screen.queryByText("EIN")).not.toBeInTheDocument();
    expect(screen.queryByText("Paid in full")).not.toBeInTheDocument();
    // The always-present rows still render.
    expect(screen.getByText("Entity type")).toBeInTheDocument();
  });
});

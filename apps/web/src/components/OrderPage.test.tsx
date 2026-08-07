import { render, screen, waitFor } from "@testing-library/react";
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
    expect(screen.getByText("Wyoming")).toBeInTheDocument();
    expect(screen.getByText("07-891-2345")).toBeInTheDocument();
    expect(screen.getByText("One-Time")).toBeInTheDocument();
  });

  it("shows the incorporation date with the corp's age beside it", async () => {
    await renderPage();
    expect(screen.getByText("Incorporated")).toBeInTheDocument();
    expect(screen.getByText("March 15, 2016 (8 Years Old)")).toBeInTheDocument();
  });

  // Age__c is fractional: the sandbox's "Devin LLC", filed 18 days before this was written,
  // reads 0.05 — which floors to 0 and used to render no parenthetical at all.
  it("says 'Less than 1 Year Old' rather than '0 Years Old' for a fresh corp", async () => {
    respondWith(
      makeOrder({
        shelfCorp: makeShelfCorp({ incorporationDate: "2026-07-19", agedYears: 0.05 }),
      }),
    );
    await renderPage();
    expect(screen.getByText("July 19, 2026 (Less than 1 Year Old)")).toBeInTheDocument();
  });

  it("falls back to the age alone when Salesforce has no incorporation date", async () => {
    respondWith(makeOrder({ shelfCorp: makeShelfCorp({ incorporationDate: null }) }));
    await renderPage();
    expect(screen.getByText("(8 Years Old)")).toBeInTheDocument();
  });

  // `agedYears` lands on 0 both for a brand-new corp and for one where Age__c is empty —
  // with no filing date to back it, "Less than 1 Year Old" would be an invented claim.
  it("shows an em-dash when the record carries neither a date nor an age", async () => {
    respondWith(
      makeOrder({ shelfCorp: makeShelfCorp({ incorporationDate: null, agedYears: 0 }) }),
    );
    await renderPage();
    expect(screen.getByText("Incorporated")).toBeInTheDocument();
    expect(screen.queryByText(/Year Old/)).not.toBeInTheDocument();
  });

  it("shows the corp name alone, without the entity-type/package blurb", async () => {
    await renderPage();
    expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    expect(screen.queryByText(/Credit-Ready package/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/8-year aged/)).not.toBeInTheDocument();
  });

  // All removed from the portal on 2026-08-07 at the stakeholder's request, and all off the
  // DTO too — nothing should be able to put them back by accident. The EIN especially: it
  // is the corp's federal tax ID and no longer leaves Salesforce at all.
  it("never shows the fields that were taken out of the portal", async () => {
    await renderPage();
    for (const label of [
      "EIN",
      "EIN issued",
      "Credit score",
      "Funding capacity",
      "Corp #",
      "Registered agent",
    ]) {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
    expect(screen.queryByText(/88-1234567/)).not.toBeInTheDocument();
  });

  it("omits detail rows Salesforce hasn't filled in rather than showing em-dashes", async () => {
    respondWith(makeOrder({ fullyPaidAt: null, shelfCorp: makeShelfCorp({ duns: null }) }));
    await renderPage();
    expect(screen.queryByText("D-U-N-S")).not.toBeInTheDocument();
    expect(screen.queryByText("Paid in full")).not.toBeInTheDocument();
    // The always-present rows still render.
    expect(screen.getByText("Entity type")).toBeInTheDocument();
  });
});

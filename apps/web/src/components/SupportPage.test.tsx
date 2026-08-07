import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Order } from "@wsc/shared";
import {
  TEST_CLIENT,
  makeOrder,
  makePendingOrder,
  makeShelfCorp,
  makeStaff,
} from "../test/fixtures";
import { SupportPage } from "./SupportPage";

const renderWith = async (orders: Order[]) => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ client: TEST_CLIENT, orders }), { status: 200 }),
      ),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SupportPage />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText("Your team")).toBeInTheDocument());
};

describe("SupportPage", () => {
  it("tells the client what each person handles, not just who they are", async () => {
    await renderWith([makeOrder()]);

    expect(screen.getByText("Lua Espluga")).toBeInTheDocument();
    expect(screen.getByText(/Anything about your order goes through/)).toBeInTheDocument();
    expect(screen.getByText("Rinki Gurjar")).toBeInTheDocument();
    expect(screen.getByText(/^Documentation —/)).toBeInTheDocument();
  });

  it("shows each person once across orders, with the products they cover", async () => {
    // Two paid orders, same support team — the client should see one Lua, not two.
    const second = makeOrder({
      id: "o3",
      orderNumber: "UO1423104",
      shelfCorp: makeShelfCorp({ id: "s2", name: "Devin LLC" }),
    });
    await renderWith([makeOrder(), second]);

    expect(screen.getAllByText("Lua Espluga")).toHaveLength(1);
    expect(screen.getAllByText("For 2016 Wyoming LLC, Devin LLC")).toHaveLength(2);
  });

  it("keeps the advisor alongside support when one order is still unpaid", async () => {
    await renderWith([makePendingOrder(), makeOrder()]);

    expect(screen.getByText("Sales Advisor")).toBeInTheDocument();
    expect(screen.getByText("Support Manager")).toBeInTheDocument();
    // Both sets are live, so "the advisor is done" would be wrong here.
    expect(screen.queryByText(/sales advisor's part is complete/i)).not.toBeInTheDocument();
  });

  it("names the unpaid order by its number while it has no corp assigned", async () => {
    await renderWith([makePendingOrder(), makeOrder()]);
    expect(screen.getByText("For UO1423103")).toBeInTheDocument();
  });

  it("drops the coverage line when there is nothing to disambiguate", async () => {
    await renderWith([makeOrder()]);
    expect(screen.queryByText(/^For /)).not.toBeInTheDocument();
  });

  it("explains the hand-off once every order has moved to support", async () => {
    await renderWith([makeOrder()]);
    expect(screen.getByText(/sales advisor's part is complete/i)).toBeInTheDocument();
  });

  it("admits an unassigned role instead of naming someone", async () => {
    await renderWith([makeOrder({ supportManager: null })]);

    expect(screen.getByText(/Support Manager — not yet assigned/)).toBeInTheDocument();
    expect(screen.queryByText("Lua Espluga")).not.toBeInTheDocument();
  });

  it("always offers the company's own contact details", async () => {
    await renderWith([]);

    expect(screen.getByRole("link", { name: "(720) 534-2065" })).toHaveAttribute(
      "href",
      // "+1", not a bare "720…" — RFC 3966 needs the country code, or the number only
      // connects from inside the US.
      "tel:+17205342065",
    );
    expect(
      screen.getByRole("link", { name: "Support@WholesaleShelfCorporations.com" }),
    ).toHaveAttribute("href", "mailto:Support@WholesaleShelfCorporations.com");
    // 1-720…, not 720… — wa.me reads a bare "720…" as country code 7 (Russia). This is the
    // company's own card, so getting it wrong sends every client to a stranger.
    expect(screen.getByRole("link", { name: "Message us" })).toHaveAttribute(
      "href",
      "https://wa.me/17205342065",
    );
    expect(screen.getByText("5500 Greenwood Plaza Blvd, Suite 130")).toBeInTheDocument();
    expect(screen.getByText("Greenwood Village, CO 80111")).toBeInTheDocument();
  });

  it("points a client with no orders at the company line rather than an empty page", async () => {
    await renderWith([]);
    expect(screen.getByText(/no one is assigned to you/)).toBeInTheDocument();
  });

  it("offers no ticket form — raising one writes to Salesforce (Q5, deferred)", async () => {
    await renderWith([makeOrder()]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("omits a channel the team member never filled in", async () => {
    await renderWith([
      makeOrder({
        supportManager: makeStaff("support-manager", { name: "Lua Espluga", phone: null }),
        backEndSupport: null,
      }),
    ]);
    expect(screen.queryByRole("link", { name: "+1 (720) 534-2065" })).not.toBeInTheDocument();
  });
});

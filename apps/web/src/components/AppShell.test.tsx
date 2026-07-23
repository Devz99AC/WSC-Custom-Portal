import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { OrderDashboardDto } from "@wsc/shared";
import { AppShell } from "./AppShell";

const demo: OrderDashboardDto = {
  client: {
    id: "c1",
    email: "m.brown@acmeholdings.com",
    name: "Marcus Brown",
    phone: "+1 (305) 555-0148",
    businessName: "Acme Holdings LLC",
  },
  order: {
    id: "o1",
    orderNumber: "OO-1042",
    amount: 8750,
    paidToDate: 5000,
    balanceDue: 3750,
    statusSf: "Verified - Work Started",
    placedAt: "2026-05-02",
    advisorName: "Rinkie S.",
    paymentMethod: "Wire Transfer",
    shelfCorp: null,
    clientId: "c1",
  },
  payments: [],
};

describe("AppShell", () => {
  it("renders the signed-in client and every nav link, and fires sign-out", () => {
    const onSignOut = vi.fn();
    render(
      <MemoryRouter
        initialEntries={["/orders"]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          <Route element={<AppShell dashboard={demo} onSignOut={onSignOut} />}>
            <Route path="orders" element={<p>Order page content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Marcus Brown")).toBeInTheDocument();
    expect(screen.getByText("Acme Holdings LLC")).toBeInTheDocument();
    expect(screen.getByText("Order page content")).toBeInTheDocument();
    for (const label of ["Dashboard", "My Orders", "Payments", "Documents", "Profile"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    screen.getByRole("button", { name: "Sign out" }).click();
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});

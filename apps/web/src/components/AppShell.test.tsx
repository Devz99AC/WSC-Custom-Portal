import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { Client } from "@wsc/shared";
import { AppShell } from "./AppShell";

const demoClient: Client = {
  id: "c1",
  email: "m.brown@acmeholdings.com",
  name: "Marcus Brown",
  phone: "+1 (305) 555-0148",
  businessName: "Acme Holdings LLC",
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
          <Route element={<AppShell client={demoClient} onSignOut={onSignOut} />}>
            <Route path="orders" element={<p>Order page content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Marcus Brown")).toBeInTheDocument();
    expect(screen.getByText("Acme Holdings LLC")).toBeInTheDocument();
    expect(screen.getByText("Order page content")).toBeInTheDocument();
    for (const label of ["My Orders", "Payments", "Documents", "Profile"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    screen.getByRole("button", { name: "Sign out" }).click();
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Order } from "@wsc/shared";
import { StaffCard } from "./StaffCard";

const baseOrder: Order = {
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
};

describe("StaffCard", () => {
  it("shows the real Sales Advisor before payment is verified", () => {
    render(<StaffCard order={baseOrder} />);
    expect(screen.getByText("Rinkie S.")).toBeInTheDocument();
    expect(screen.getByText(/Sales Advisor/)).toBeInTheDocument();
  });

  it("hands off to the Implementation Manager once payment is verified", () => {
    render(<StaffCard order={{ ...baseOrder, statusSf: "Verified - Work Started" }} />);
    expect(screen.getByText("Lua")).toBeInTheDocument();
    expect(screen.getByText(/Implementation Manager/)).toBeInTheDocument();
    expect(screen.getByText(/pending confirmation/)).toBeInTheDocument();
  });
});

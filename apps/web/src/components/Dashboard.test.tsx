import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OrderDashboardDto } from "@wsc/shared";
import { Dashboard } from "./Dashboard";

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
    shelfCorp: {
      id: "s1",
      name: "2016 Wyoming LLC",
      entityType: "LLC",
      stateOfFormation: "Wyoming",
      incorporationDate: "2016-03-15",
      agedYears: 8,
      price: 8750,
      duns: "07-891-2345",
      creditReadyFeatures: ["Business address", "Business phone", "411 listing", "D-U-N-S"],
    },
    clientId: "c1",
  },
  payments: [
    {
      id: "p1",
      orderId: "o1",
      amount: 2500,
      method: "Wire Transfer",
      statusSf: "Cleared",
      isVerified: true,
      statusDate: "2026-05-08T16:40:00.000Z",
    },
  ],
};

describe("Dashboard", () => {
  it("renders real-shaped Salesforce data (client, order, corp, advisor, stage)", () => {
    render(<Dashboard dashboard={demo} onSignOut={() => undefined} />);

    expect(screen.getByText("Marcus Brown")).toBeInTheDocument();
    expect(screen.getByText(/OO-1042/)).toBeInTheDocument();
    expect(screen.getByText(/2016 Wyoming LLC/)).toBeInTheDocument();
    expect(screen.getByText("Wyoming")).toBeInTheDocument();
    expect(screen.getByText("Rinkie S.")).toBeInTheDocument();
    // "Work Started" appears in both the tracker and the status badge (label resolved
    // from @wsc/shared — never hardcoded).
    expect(screen.getAllByText("Work Started").length).toBeGreaterThanOrEqual(1);
  });
});

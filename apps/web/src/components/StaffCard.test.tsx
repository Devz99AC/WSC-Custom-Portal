import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeOrder, makePendingOrder, makeStaff } from "../test/fixtures";
import { StaffCard } from "./StaffCard";

describe("StaffCard", () => {
  it("shows only the Sales Advisor, with all four channels, while the sale is still open", () => {
    render(<StaffCard order={makePendingOrder({ supportManager: null, backEndSupport: null })} />);

    expect(screen.getByText("Rinkie S.")).toBeInTheDocument();
    expect(screen.getByText("Sales Advisor")).toBeInTheDocument();
    expect(screen.getByText("rinkie@wholesaleshelfcorporations.com")).toBeInTheDocument();
    expect(screen.getByText("+1 (720) 534-2065")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp" })).toBeInTheDocument();

    expect(screen.queryByText("Support Manager")).not.toBeInTheDocument();
    expect(screen.queryByText("Back-End Support")).not.toBeInTheDocument();
  });

  it("hands off to BOTH support contacts once payment is verified, and drops the advisor", () => {
    render(<StaffCard order={makeOrder()} />);

    expect(screen.getByText("Support Manager")).toBeInTheDocument();
    expect(screen.getByText("Lua Espluga")).toBeInTheDocument();
    expect(screen.getByText("Back-End Support")).toBeInTheDocument();
    expect(screen.getByText("Rinki Gurjar")).toBeInTheDocument();

    // The advisor's line closes when the sale closes — showing them would send the client
    // to someone who no longer handles the order.
    expect(screen.queryByText("Sales Advisor")).not.toBeInTheDocument();
  });

  it("explains that communication moves to support after the sale closes", () => {
    render(<StaffCard order={makeOrder()} />);
    expect(screen.getByText(/goes through the support contacts above/)).toBeInTheDocument();
  });

  it("does not show the hand-off note while the advisor is still the contact", () => {
    render(<StaffCard order={makePendingOrder()} />);
    expect(screen.queryByText(/goes through the support contacts above/)).not.toBeInTheDocument();
  });

  it("says 'not yet assigned' instead of inventing a name for an empty Salesforce lookup", () => {
    render(<StaffCard order={makeOrder({ supportManager: null, backEndSupport: null })} />);
    expect(screen.getByText(/Support Manager — not yet assigned/)).toBeInTheDocument();
    expect(screen.getByText(/Back-End Support — not yet assigned/)).toBeInTheDocument();
  });

  it("builds a wa.me link from the stored phone, stripping formatting", () => {
    render(
      <StaffCard
        order={makePendingOrder({
          advisor: makeStaff("advisor", { whatsAppNumber: "+1 (720) 534-2065" }),
        })}
      />,
    );
    expect(screen.getByRole("link", { name: "WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/17205342065",
    );
  });

  it("omits a channel the team member hasn't filled in rather than rendering a dead link", () => {
    render(
      <StaffCard
        order={makePendingOrder({
          advisor: makeStaff("advisor", { whatsAppNumber: null, email: null }),
        })}
      />,
    );
    expect(screen.queryByRole("link", { name: "WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByText(/@wholesaleshelfcorporations/)).not.toBeInTheDocument();
    expect(screen.getByText("+1 (720) 534-2065")).toBeInTheDocument();
  });
});

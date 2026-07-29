import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderTracker } from "./OrderTracker";

const track = (overrides: Partial<Parameters<typeof OrderTracker>[0]> = {}) =>
  render(
    <OrderTracker
      statusSf="Verified - Work Started"
      fullyPaidAt="2026-05-08"
      initialContactAt="2026-05-19"
      completedAt={null}
      onHoldReason={null}
      {...overrides}
    />,
  );

/** The bar renders one ring per step; a completed step shows ✓ instead of its number. */
const completedSteps = () => screen.getAllByText("✓").length;

describe("OrderTracker", () => {
  it("renders the 4 client-facing steps, not the raw Salesforce statuses", () => {
    track();
    expect(screen.getByText("Unpaid")).toBeInTheDocument();
    expect(screen.getByText("Initial Onboarding Call")).toBeInTheDocument();
    expect(screen.getByText("Work Started")).toBeInTheDocument();
    expect(screen.getByText("Complete — ready for funding")).toBeInTheDocument();
    expect(screen.queryByText("Verified - Work Started")).not.toBeInTheDocument();
  });

  it("marks the steps before the current one as done", () => {
    track({ statusSf: "Verified - Work Started" });
    expect(completedSteps()).toBe(2); // Unpaid + Initial Onboarding Call
  });

  it("drops the progress bar entirely for a cancelled order", () => {
    track({ statusSf: "Cancelled - Refunded" });
    // A half-filled grey bar reads as "in progress" — there must be no bar at all.
    expect(screen.queryByText("Work Started")).not.toBeInTheDocument();
    expect(screen.getByText(/This order was cancelled/)).toBeInTheDocument();
  });

  it("keeps a paused order's bar and explains why it stopped", () => {
    track({
      statusSf: "ON HOLD - Client's Unresponsive",
      onHoldReason: "Waiting on your signed EIN form",
    });
    expect(screen.getByText("On hold")).toBeInTheDocument();
    expect(screen.getByText("Waiting on your signed EIN form")).toBeInTheDocument();
    // Status__c was overwritten by the hold, so progress comes from the timestamps.
    expect(screen.getByText("Initial Onboarding Call")).toBeInTheDocument();
    expect(completedSteps()).toBe(1);
  });

  it("still says something useful when a paused order has no reason recorded", () => {
    track({ statusSf: "ON HOLD - Other Reasons", onHoldReason: null });
    expect(screen.getByText(/Your advisor will get in touch/)).toBeInTheDocument();
  });
});

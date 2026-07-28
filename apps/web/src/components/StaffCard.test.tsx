import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makePendingOrder } from "../test/fixtures";
import { StaffCard } from "./StaffCard";

const baseOrder = makePendingOrder();

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

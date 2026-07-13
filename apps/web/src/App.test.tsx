import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the canonical order stages sourced from @wsc/shared", () => {
    render(<App />);
    expect(screen.getByText("To Verify Payment")).toBeInTheDocument();
    expect(screen.getByText("Work Started")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});

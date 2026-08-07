import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    // No session cookie in tests — the BFF would answer 401, so App falls back to Login.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
  });

  it("shows the passwordless login screen when there is no session", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Welcome back")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /secure sign-in link/i })).toBeInTheDocument();
  });
});

/**
 * A tab that outlived a deploy runs JavaScript older than the API it calls, so a field its
 * schema still requires can already be gone. Retrying never fixes it — only fetching the
 * new bundle does. These two cases are the whole contract: heal once, then stop.
 */
describe("App recovering from a stale bundle", () => {
  const reload = vi.fn();

  const renderWithStalePayload = async () => {
    // Missing `shelfCorp` entirely: what an old schema sees after fields are dropped.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ client: {}, orders: [{}] }), { status: 200 }),
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    reload.mockClear();
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...window.location, reload },
    });
  });

  it("reloads itself once to pick up the new bundle", async () => {
    await renderWithStalePayload();
    await waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1);
    });
  });

  it("shows a readable message instead of looping when the reload didn't help", async () => {
    // Standing in for "this tab already reloaded once" — a genuine server-side payload bug
    // would otherwise put the client in an endless reload.
    sessionStorage.setItem("wsc.reloaded-for-outdated-client", "1");

    await renderWithStalePayload();

    await waitFor(() => {
      expect(screen.getByText(/updated while this tab was open/i)).toBeInTheDocument();
    });
    expect(reload).not.toHaveBeenCalled();
    // The raw ZodError is what a client actually saw on 2026-08-07.
    expect(screen.queryByText(/invalid_type/)).not.toBeInTheDocument();
  });
});

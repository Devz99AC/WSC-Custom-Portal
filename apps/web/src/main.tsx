import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "./styles/theme.css";

/**
 * Read-mostly portal against a rate-limited Salesforce backend: the data (orders, payments,
 * documents) changes rarely and is controlled by ops, not the client. TanStack Query's
 * defaults (`staleTime: 0` + `refetchOnWindowFocus: true`) refetched on *every* tab/app
 * switch, which flashed "Loading your portal…" each time the window regained focus and
 * burned API budget for no benefit — the portal felt like it reloaded instead of staying
 * put like a normal page. So: keep data fresh for 5 minutes, and never refetch merely
 * because the window regained focus. A client who wants the very latest can hard-refresh;
 * a deploy still self-heals through the OutdatedClientError path on the next real fetch.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found");
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);

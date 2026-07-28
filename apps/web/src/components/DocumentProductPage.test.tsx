import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_CLIENT, makeDocument, makeOrder } from "../test/fixtures";
import { DocumentProductPage } from "./DocumentProductPage";

const ORDERS_RESPONSE = { client: TEST_CLIENT, orders: [makeOrder()] };

const stubFetch = (documents: unknown[]) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      const body = url.includes("/api/documents") ? { documents } : ORDERS_RESPONSE;
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }),
  );
};

const renderAt = (path: string) => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/documents/:corpId" element={<DocumentProductPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("DocumentProductPage", () => {
  beforeEach(() => {
    stubFetch([makeDocument()]);
  });

  it("resolves the product from the :corpId route param and lists its files", async () => {
    renderAt("/documents/s1");
    await waitFor(() => {
      expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    });
    expect(screen.getByText("Articles of Organization.pdf")).toBeInTheDocument();
    expect(screen.getByText("UO1423102")).toBeInTheDocument();
  });

  it("downloads through the BFF, never straight from Salesforce", async () => {
    renderAt("/documents/s1");
    await waitFor(() => {
      expect(screen.getByText("Articles of Organization.pdf")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      "/api/documents/00P1/download",
    );
  });

  it("shows an honest empty state when nothing has been shared for the product", async () => {
    stubFetch([]);
    renderAt("/documents/s1");
    await waitFor(() => {
      expect(screen.getByText(/No documents have been shared yet/)).toBeInTheDocument();
    });
  });

  it("does not leak another product's files into this one", async () => {
    stubFetch([makeDocument({ id: "00P9", name: "Someone else.pdf", shelfCorpId: "s-other" })]);
    renderAt("/documents/s1");
    await waitFor(() => {
      expect(screen.getByText(/No documents have been shared yet/)).toBeInTheDocument();
    });
    expect(screen.queryByText("Someone else.pdf")).not.toBeInTheDocument();
  });
});

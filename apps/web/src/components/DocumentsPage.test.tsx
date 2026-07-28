import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_CLIENT, makeDocument, makeOrder, makePendingOrder } from "../test/fixtures";
import { DocumentsPage } from "./DocumentsPage";

const ORDERS_RESPONSE = {
  client: TEST_CLIENT,
  orders: [makePendingOrder(), makeOrder()],
};

const DOCUMENTS_RESPONSE = {
  documents: [
    makeDocument(),
    makeDocument({ id: "00P2", name: "EIN Confirmation Letter.pdf" }),
    // On the unpaid order, which has no shelf corp assigned yet.
    makeDocument({
      id: "00P3",
      name: "Wire Transfer Instructions.pdf",
      shelfCorpId: null,
      orderId: "o1",
      orderNumber: "UO1423103",
    }),
  ],
};

const stubFetch = (documents = DOCUMENTS_RESPONSE) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      const body = url.includes("/api/documents") ? documents : ORDERS_RESPONSE;
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
    }),
  );
};

const renderPage = () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("DocumentsPage", () => {
  beforeEach(() => {
    stubFetch();
  });

  it("segments by product (shelf corp), not by order number", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    });
    // The order number is never a group heading — only a column value.
    expect(screen.queryByRole("link", { name: "UO1423102" })).not.toBeInTheDocument();
  });

  it("counts the documents filed under each product", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    });
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("keeps files reachable when their order has no shelf corp assigned yet", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Not linked to a product yet")).toBeInTheDocument();
    });
    expect(screen.getByText(/grouped separately until your advisor links one/)).toBeInTheDocument();
  });

  it("still lists a product the client owns even with zero documents", async () => {
    stubFetch({ documents: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("2016 Wyoming LLC")).toBeInTheDocument();
    });
    expect(screen.queryByText("Not linked to a product yet")).not.toBeInTheDocument();
  });
});

import type { Order, PortalDocument } from "@wsc/shared";

/** Route/group id for files on an order that has no shelf corp assigned yet. Grouping is
 *  by product, so these have nowhere to go — they get their own bucket rather than being
 *  silently dropped, which is what a client would experience as "my file disappeared". */
export const UNFILED_PRODUCT_ID = "unassigned";

export interface DocumentProduct {
  id: string;
  name: string;
  entityType: string;
  orderNumbers: string[];
  documentCount: number;
}

/**
 * Groups the client's documents by the product (shelf corp) their parent order points at.
 *
 * A product appears if the client owns it, even with zero documents — an empty product is
 * meaningful ("nothing shared yet"), whereas hiding it would look like the product itself
 * was missing. The unfiled bucket is the opposite: it only appears when it has files.
 */
export function groupDocumentsByProduct(
  orders: readonly Order[],
  documents: readonly PortalDocument[],
): DocumentProduct[] {
  const products = new Map<string, DocumentProduct>();

  for (const order of orders) {
    const corp = order.shelfCorp;
    if (!corp) {
      continue;
    }
    const existing = products.get(corp.id);
    if (existing) {
      existing.orderNumbers.push(order.orderNumber);
    } else {
      products.set(corp.id, {
        id: corp.id,
        name: corp.name,
        entityType: corp.entityType,
        orderNumbers: [order.orderNumber],
        documentCount: 0,
      });
    }
  }

  for (const document of documents) {
    const product = document.shelfCorpId ? products.get(document.shelfCorpId) : undefined;
    if (product) {
      product.documentCount += 1;
      continue;
    }

    const unfiled = products.get(UNFILED_PRODUCT_ID) ?? {
      id: UNFILED_PRODUCT_ID,
      name: "Not linked to a product yet",
      entityType: "—",
      orderNumbers: [],
      documentCount: 0,
    };
    unfiled.documentCount += 1;
    if (!unfiled.orderNumbers.includes(document.orderNumber)) {
      unfiled.orderNumbers.push(document.orderNumber);
    }
    products.set(UNFILED_PRODUCT_ID, unfiled);
  }

  return [...products.values()];
}

/** The documents filed under one product id, including the unfiled bucket. */
export function documentsForProduct(
  documents: readonly PortalDocument[],
  productId: string,
): PortalDocument[] {
  return documents.filter((document) =>
    productId === UNFILED_PRODUCT_ID
      ? document.shelfCorpId === null
      : document.shelfCorpId === productId,
  );
}

/** Human-readable file size. Salesforce reports `BodyLength` in bytes. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

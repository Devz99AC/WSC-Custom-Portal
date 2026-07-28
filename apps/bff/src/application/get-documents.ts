import type { DocumentsList } from "@wsc/shared";
import type { DocumentDownload, PortalRepository } from "./ports/portal-repository.js";

/** Use-case: the documents shared with the authenticated customer, and their bytes.
 *  Both paths are scoped by the caller's own email — never by an id from the request. */
export class GetDocuments {
  constructor(private readonly repository: PortalRepository) {}

  list(email: string): Promise<DocumentsList | null> {
    return this.repository.listDocumentsByEmail(email.trim().toLowerCase());
  }

  download(email: string, documentId: string): Promise<DocumentDownload | null> {
    return this.repository.getDocumentForDownload(email.trim().toLowerCase(), documentId);
  }
}

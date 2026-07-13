/**
 * Base class for typed domain errors (centralized, typed error handling —
 * CLAUDE.md §2, ROADMAP §5.2). Concrete errors (e.g. `ShelfCorpAlreadyReserved`,
 * `PaymentNotVerified`) and their HTTP-status mapping arrive with the use-cases
 * that raise them in later phases. Nothing throws these yet.
 */
export abstract class DomainError extends Error {
  /** Stable machine-readable code used by the error middleware to map to HTTP. */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

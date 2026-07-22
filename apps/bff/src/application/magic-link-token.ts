import { createHash, randomBytes } from "node:crypto";

/** Raw token that goes in the emailed link — never stored, only its hash is (ARCHITECTURE.md §3.2). */
export function generateMagicLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashMagicLinkToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

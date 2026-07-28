import { existsSync, readFileSync } from "node:fs";

/**
 * Rebuilds a canonical PEM string regardless of how mangled the input formatting is —
 * env var UIs are inconsistent about preserving real newlines vs. literal "\n" text vs.
 * collapsing whitespace entirely when pasting multi-line content, and the BEGIN/END
 * markers themselves are sometimes dropped if only the base64 body got copied. Strips
 * everything that isn't valid base64 and re-wraps it at the standard 64-column width
 * under PKCS#8 markers (defaulting to "PRIVATE KEY" when none were present), so
 * `crypto.createPrivateKey` gets a well-formed PEM either way.
 *
 * Shared by every JWT-signing adapter (Salesforce JWT Bearer, Gmail service account) —
 * this was hard-won from a real production incident, so it lives in one place.
 */
export function normalizePem(value: string): string {
  const match = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(value);
  const label = match?.[1] ?? "PRIVATE KEY";
  const rawBody = match?.[2] ?? value;
  const body = rawBody.replace(/[^A-Za-z0-9+/=]/g, "");
  const wrapped = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`;
}

/** Accepts either the PEM contents directly (deployed hosts) or a path to the key file (local dev). */
export function resolvePrivateKey(value: string): string {
  if (value.includes("BEGIN") || !existsSync(value)) {
    return normalizePem(value);
  }
  return readFileSync(value, "utf8");
}

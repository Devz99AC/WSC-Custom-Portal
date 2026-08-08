import { describe, expect, it } from "vitest";
import { RequestMagicLink } from "./request-magic-link.js";
import { InMemoryMagicLinkStore } from "../infrastructure/auth/in-memory-magic-link-store.js";
import type { ClientIdentity, PortalRepository } from "./ports/portal-repository.js";
import type { EmailMessage } from "./ports/email-sender.js";

const KNOWN_EMAIL = "m.brown@acmeholdings.com";
const CLIENT: ClientIdentity = { id: "client-1", email: KNOWN_EMAIL, name: "Marcus Brown" };

/** Only the slice RequestMagicLink depends on — see its constructor. */
class FakeRepository implements Pick<PortalRepository, "findClientByEmail"> {
  findClientByEmail(email: string): ReturnType<PortalRepository["findClientByEmail"]> {
    return Promise.resolve(email === KNOWN_EMAIL ? CLIENT : null);
  }
}

function buildUseCase(sent: EmailMessage[]): RequestMagicLink {
  return new RequestMagicLink(
    new FakeRepository(),
    new InMemoryMagicLinkStore(),
    (message) => {
      sent.push(message);
      return Promise.resolve();
    },
    ({ verifyUrl }) => ({ subject: "Sign in", html: verifyUrl, text: verifyUrl }),
    { appBaseUrl: "http://localhost:5173", ttlSeconds: 900 },
  );
}

describe("RequestMagicLink", () => {
  it("emails a link for a known email and reports it was sent", async () => {
    const sent: EmailMessage[] = [];
    await expect(buildUseCase(sent).execute(KNOWN_EMAIL)).resolves.toBe(true);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(KNOWN_EMAIL);
    expect(sent[0]?.text).toContain("http://localhost:5173/auth/verify?token=");
  });

  // The email→client resolution now doubles as the access gate: an address with no live
  // order returns null from the repository, so execute reports `false` and sends nothing.
  // The HTTP layer turns that into the "no access" message (stakeholder decision 2026-08-08).
  it("reports false and sends nothing for an email with no access", async () => {
    const sent: EmailMessage[] = [];
    await expect(buildUseCase(sent).execute("nobody@example.com")).resolves.toBe(false);
    expect(sent).toHaveLength(0);
  });
});

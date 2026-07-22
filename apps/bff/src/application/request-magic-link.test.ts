import { describe, expect, it } from "vitest";
import { RequestMagicLink } from "./request-magic-link.js";
import { InMemoryMagicLinkStore } from "../infrastructure/auth/in-memory-magic-link-store.js";
import type { ClientIdentity, PortalRepository } from "./ports/portal-repository.js";
import type { EmailMessage } from "./ports/email-sender.js";

const KNOWN_EMAIL = "m.brown@acmeholdings.com";
const CLIENT: ClientIdentity = { id: "client-1", email: KNOWN_EMAIL, name: "Marcus Brown" };

class FakeRepository implements PortalRepository {
  getDashboardByEmail(): ReturnType<PortalRepository["getDashboardByEmail"]> {
    return Promise.resolve(null);
  }

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
  it("emails a link with a token for a known email", async () => {
    const sent: EmailMessage[] = [];
    await buildUseCase(sent).execute(KNOWN_EMAIL);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(KNOWN_EMAIL);
    expect(sent[0]?.text).toContain("http://localhost:5173/auth/verify?token=");
  });

  it("sends nothing for an unknown email, without throwing (anti-enumeration)", async () => {
    const sent: EmailMessage[] = [];
    await expect(buildUseCase(sent).execute("nobody@example.com")).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});

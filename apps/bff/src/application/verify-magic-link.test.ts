import { describe, expect, it } from "vitest";
import { VerifyMagicLink } from "./verify-magic-link.js";
import { InMemoryMagicLinkStore } from "../infrastructure/auth/in-memory-magic-link-store.js";
import { generateMagicLinkToken, hashMagicLinkToken } from "./magic-link-token.js";

describe("VerifyMagicLink", () => {
  it("resolves a valid token once, then invalidates it (single-use)", async () => {
    const store = new InMemoryMagicLinkStore();
    const rawToken = generateMagicLinkToken();
    await store.save(hashMagicLinkToken(rawToken), { clientId: "c1", email: "m.brown@acmeholdings.com" }, 900);

    const useCase = new VerifyMagicLink(store);
    await expect(useCase.execute(rawToken)).resolves.toEqual({
      clientId: "c1",
      email: "m.brown@acmeholdings.com",
    });
    await expect(useCase.execute(rawToken)).resolves.toBeNull();
  });

  it("returns null for an unknown token", async () => {
    const useCase = new VerifyMagicLink(new InMemoryMagicLinkStore());
    await expect(useCase.execute("does-not-exist")).resolves.toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createResendEmailSender } from "./resend-email-sender.js";

const BASE = { apiKey: "re_test", fromEmail: "noreply@example.com", fromName: "WSC" };

const MESSAGE = {
  to: "client@example.com",
  subject: "Sign in",
  html: "<p>link</p>",
  text: "link",
};

const stubFetch = (status = 200, body = "{}") => {
  const spy = vi.fn().mockResolvedValue(new Response(body, { status }));
  vi.stubGlobal("fetch", spy);
  return spy;
};

const sentBody = (spy: ReturnType<typeof stubFetch>): Record<string, unknown> =>
  JSON.parse(String((spy.mock.calls[0]?.[1] as RequestInit).body));

afterEach(() => vi.unstubAllGlobals());

describe("createResendEmailSender", () => {
  it("routes replies to a mailbox a human reads when one is configured", async () => {
    const spy = stubFetch();
    await createResendEmailSender({ ...BASE, replyToEmail: "support@example.com" })(MESSAGE);

    const body = sentBody(spy);
    expect(body["from"]).toBe("WSC <noreply@example.com>");
    // Without this, a client replying to a failed sign-in email talks to nobody.
    expect(body["reply_to"]).toBe("support@example.com");
  });

  it("omits reply_to entirely when unset, rather than sending it empty", async () => {
    const spy = stubFetch();
    await createResendEmailSender(BASE)(MESSAGE);

    expect(sentBody(spy)).not.toHaveProperty("reply_to");
  });

  it("fails loudly on a rejected send so the cause reaches the server log", async () => {
    stubFetch(403, "domain is not verified");
    await expect(createResendEmailSender(BASE)(MESSAGE)).rejects.toThrow(/403/);
  });
});

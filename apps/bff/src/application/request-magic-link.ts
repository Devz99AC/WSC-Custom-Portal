import type { PortalRepository } from "./ports/portal-repository.js";
import type { MagicLinkStore } from "./ports/magic-link-store.js";
import type { EmailSender } from "./ports/email-sender.js";
import { generateMagicLinkToken, hashMagicLinkToken } from "./magic-link-token.js";

export interface RequestMagicLinkConfig {
  appBaseUrl: string;
  ttlSeconds: number;
}

export interface RenderMagicLinkEmail {
  (input: { name: string; verifyUrl: string; ttlMinutes: number }): {
    subject: string;
    html: string;
    text: string;
  };
}

/**
 * Use-case: request a magic-link (ADR-0005, ARCHITECTURE.md §3.2). Resolves the sign-in
 * identity (`findClientByEmail`, which now also gates on the client having a live order —
 * see the repository) and, when it matches, sends the link.
 *
 * Returns whether a link was sent (`true`) or the email had no portal access (`false`).
 * The HTTP layer turns that boolean into the granted/denied message the login screen shows
 * (server.ts). ⚠️ This is a deliberate REVERSAL of the earlier anti-enumeration stance:
 * the stakeholder chose (2026-08-08) to tell a denied visitor they have no access, trading
 * account-existence hiding for clearer UX. The reveal decision lives in the HTTP layer; this
 * use-case only reports the fact.
 */
export class RequestMagicLink {
  constructor(
    // Narrowed to the one method this use-case actually calls: sign-in resolves an
    // identity and nothing more, so growing PortalRepository with new read methods can't
    // ripple into this use-case or its test doubles.
    private readonly repository: Pick<PortalRepository, "findClientByEmail">,
    private readonly store: MagicLinkStore,
    private readonly sendEmail: EmailSender,
    private readonly renderEmail: RenderMagicLinkEmail,
    private readonly config: RequestMagicLinkConfig,
  ) {}

  async execute(email: string): Promise<boolean> {
    const client = await this.repository.findClientByEmail(email.trim().toLowerCase());
    if (!client) {
      return false;
    }

    const rawToken = generateMagicLinkToken();
    await this.store.save(
      hashMagicLinkToken(rawToken),
      { clientId: client.id, email: client.email },
      this.config.ttlSeconds,
    );

    const verifyUrl = `${this.config.appBaseUrl}/auth/verify?token=${encodeURIComponent(rawToken)}`;
    const ttlMinutes = Math.round(this.config.ttlSeconds / 60);
    const { subject, html, text } = this.renderEmail({ name: client.name, verifyUrl, ttlMinutes });

    await this.sendEmail({ to: client.email, subject, html, text });
    return true;
  }
}

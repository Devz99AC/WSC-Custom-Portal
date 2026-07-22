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
 * Use-case: request a magic-link (ADR-0005, ARCHITECTURE.md §3.2). Always completes the
 * same way regardless of whether the email matches a client — the HTTP layer must return
 * an identical response either way (anti account-enumeration). Unknown emails simply
 * result in no email being sent; nothing here reveals that distinction to the caller.
 */
export class RequestMagicLink {
  constructor(
    private readonly repository: PortalRepository,
    private readonly store: MagicLinkStore,
    private readonly sendEmail: EmailSender,
    private readonly renderEmail: RenderMagicLinkEmail,
    private readonly config: RequestMagicLinkConfig,
  ) {}

  async execute(email: string): Promise<void> {
    const client = await this.repository.findClientByEmail(email.trim().toLowerCase());
    if (!client) {
      return;
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
  }
}

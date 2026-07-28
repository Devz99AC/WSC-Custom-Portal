import type { EmailSender } from "../../application/ports/email-sender.js";

export interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

const SEND_URL = "https://api.resend.com/emails";

/**
 * Sends through Resend's HTTPS API.
 *
 * Why an HTTP transport at all: Railway blocks outbound SMTP entirely (verified
 * 2026-07-24 — TCP connects to smtp.gmail.com time out on both 587 and 465, while
 * outbound HTTPS works fine), so `createSmtpEmailSender` cannot deliver from that host.
 * The branded template and the whole magic-link flow are untouched — only the transport
 * differs, which is exactly what the EmailSender port exists for.
 */
export const createResendEmailSender = (config: ResendConfig): EmailSender => {
  return async (message) => {
    const response = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${config.fromName} <${config.fromEmail}>`,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      // Resend's body names the misconfiguration (typically a 403 for an unverified
      // sending domain, or 401 for a bad API key). Surfaced to the server log only —
      // never to the client (CLAUDE.md §2).
      throw new Error(`Resend send failed (${response.status}): ${await response.text()}`);
    }
  };
};

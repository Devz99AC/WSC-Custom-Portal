import type { EmailSender } from "../../application/ports/email-sender.js";

/**
 * Dev-only adapter: logs the email instead of sending it. Zero setup — lets the full
 * magic-link flow be exercised locally before SMTP credentials exist. Never use outside
 * dev (CLAUDE.md §4 — this would otherwise print a live login link to logs).
 */
export const createConsoleEmailSender = (): EmailSender => {
  return (message) => {
    console.log(
      `\n[console-email-sender] To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
    );
    return Promise.resolve();
  };
};

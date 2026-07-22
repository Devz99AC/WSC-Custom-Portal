import nodemailer from "nodemailer";
import type { EmailSender } from "../../application/ports/email-sender.js";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

/**
 * Sends via an existing mailbox over SMTP — Google Workspace (App Password) by default,
 * or any SMTP account. No dedicated transactional-email vendor: WSC already pays for the
 * mailbox, and this keeps the branded HTML template fully in our own code (magic-link-
 * template.ts) instead of a vendor's template editor.
 */
export const createSmtpEmailSender = (config: SmtpConfig): EmailSender => {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
  });

  return async (message) => {
    await transport.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  };
};

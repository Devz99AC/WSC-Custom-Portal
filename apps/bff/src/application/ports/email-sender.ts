export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Port for outbound transactional email — the magic-link today, notifications later. */
export type EmailSender = (message: EmailMessage) => Promise<void>;

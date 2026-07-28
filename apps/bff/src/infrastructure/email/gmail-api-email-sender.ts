import jwt from "jsonwebtoken";
import type { EmailSender, EmailMessage } from "../../application/ports/email-sender.js";
import { resolvePrivateKey } from "../crypto/pem.js";

export interface GmailApiConfig {
  /** Service account address, e.g. wsc-portal-mailer@<project>.iam.gserviceaccount.com */
  clientEmail: string;
  /** Service account private key (PEM contents, or a path to the key file in local dev). */
  privateKey: string;
  /** Workspace mailbox the service account impersonates — the real sending mailbox. */
  impersonatedUser: string;
  fromEmail: string;
  fromName: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const SCOPE = "https://www.googleapis.com/auth/gmail.send";

/** Safe against collision: every body part below is base64-encoded, so no part can ever
 *  contain this literal (base64's alphabet excludes "_" and "="-prefixed runs like this). */
const BOUNDARY = "----=_wsc_portal_boundary_v1";

type TokenResponse = { access_token: string; expires_in: number };
type CachedToken = { accessToken: string; expiresAt: number };

const base64url = (value: Buffer | string): string =>
  (typeof value === "string" ? Buffer.from(value, "utf8") : value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** RFC 2047 — only encodes when the subject actually has non-ASCII, so plain ASCII
 *  subjects stay human-readable in the raw message (easier to debug). */
const encodeSubject = (subject: string): string =>
  // eslint-disable-next-line no-control-regex
  /^[\x00-\x7F]*$/.test(subject)
    ? subject
    : `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;

/**
 * Builds an RFC 2822 multipart/alternative message. Both parts are base64-encoded rather
 * than sent raw: it sidesteps the 998-character line limit and any encoding ambiguity in
 * the branded HTML template, which is otherwise an easy source of silently mangled email.
 */
function buildMimeMessage(config: GmailApiConfig, message: EmailMessage): string {
  return [
    `From: "${config.fromName}" <${config.fromEmail}>`,
    `To: ${message.to}`,
    `Subject: ${encodeSubject(message.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${BOUNDARY}"`,
    "",
    `--${BOUNDARY}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(message.text, "utf8").toString("base64"),
    `--${BOUNDARY}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(message.html, "utf8").toString("base64"),
    `--${BOUNDARY}--`,
    "",
  ].join("\r\n");
}

/**
 * Sends through the Gmail API over HTTPS, using a service account with domain-wide
 * delegation to impersonate a real Workspace mailbox.
 *
 * Why not SMTP: Railway blocks outbound SMTP entirely (verified 2026-07-24 — TCP connects
 * to smtp.gmail.com on both 587 and 465 time out, while outbound HTTPS works fine), so
 * `createSmtpEmailSender` cannot deliver from that host. This keeps the same
 * already-paid Google Workspace mailbox and the same branded template — only the
 * transport changes, which is exactly what the EmailSender port exists for.
 *
 * The auth handshake is the same OAuth 2.0 JWT Bearer flow already used for Salesforce
 * (sign a short-lived assertion with a private key, exchange it for an access token).
 */
export const createGmailApiEmailSender = (config: GmailApiConfig): EmailSender => {
  // In-memory per process, same as the Salesforce token cache. Google returns a real TTL
  // here, so refresh proactively a minute early rather than guessing (CLAUDE.md §1).
  let cached: CachedToken | null = null;

  async function getAccessToken(): Promise<string> {
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.accessToken;
    }

    const assertion = jwt.sign(
      {
        iss: config.clientEmail,
        sub: config.impersonatedUser,
        scope: SCOPE,
        aud: TOKEN_URL,
      },
      resolvePrivateKey(config.privateKey),
      { algorithm: "RS256", expiresIn: "5m" },
    );

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!response.ok) {
      // Google's error body names the misconfiguration (unauthorized_client =
      // domain-wide delegation not granted for this scope, invalid_grant = wrong
      // impersonated user). Worth surfacing in the server log — never to the client.
      throw new Error(`Gmail token exchange failed (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as TokenResponse;
    cached = {
      accessToken: data.access_token,
      expiresAt: now + Math.max(data.expires_in - 60, 30) * 1000,
    };
    return data.access_token;
  }

  return async (message) => {
    const accessToken = await getAccessToken();
    const response = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw: base64url(buildMimeMessage(config, message)) }),
    });

    if (!response.ok) {
      // A 401 here means the cached token went stale early; drop it so the next attempt
      // re-mints rather than failing forever against a dead token.
      if (response.status === 401) {
        cached = null;
      }
      throw new Error(`Gmail send failed (${response.status}): ${await response.text()}`);
    }
  };
};

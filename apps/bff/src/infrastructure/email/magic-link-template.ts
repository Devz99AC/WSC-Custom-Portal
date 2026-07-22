export interface MagicLinkEmailInput {
  name: string;
  verifyUrl: string;
  ttlMinutes: number;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Branded magic-link email — WSC navy/red/gold tokens, same values as
 * apps/web/src/styles/theme.css and the prototype. Inline styles + a table-based button
 * only (no flex/grid): Outlook desktop renders with Word's engine, which ignores both.
 */
export function renderMagicLinkEmail({ name, verifyUrl, ttlMinutes }: MagicLinkEmailInput): RenderedEmail {
  const subject = "Sign in to your WSC Client Portal";

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f3f5f8;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;">
        <tr><td style="background:#16223f;padding:28px 32px;">
          <span style="font-family:Arial Black,Arial,sans-serif;font-weight:800;font-size:26px;letter-spacing:-0.03em;color:#ffffff;">WS<span style="color:#c8102e;">C</span></span>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#c8102e;">Client Portal</p>
          <h1 style="margin:0 0 16px;font-size:22px;color:#16223f;">Hi ${escapeHtml(name)},</h1>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#1c2331;">
            Click the button below to sign in to your WSC Client Portal. This link is valid for
            <strong>${ttlMinutes} minutes</strong> and can only be used once.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr><td style="background:#c4a259;border-radius:8px;">
              <a href="${verifyUrl}" style="display:inline-block;padding:13px 28px;font-size:14px;font-weight:800;color:#16223f;text-decoration:none;">Sign in to the portal</a>
            </td></tr>
          </table>
          <p style="margin:28px 0 0;font-size:12px;line-height:1.6;color:#6a7689;">
            If you didn't request this link, you can safely ignore this email — no account
            changes were made. Trouble signing in? Call your advisor at +1 (720) 534-2065.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Hi ${name},

Click the link below to sign in to your WSC Client Portal. This link is valid for ${ttlMinutes} minutes and can only be used once.

${verifyUrl}

If you didn't request this link, you can safely ignore this email — no account changes were made.
Trouble signing in? Call your advisor at +1 (720) 534-2065.`;

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Transactional email via Resend (https://resend.com).
//
// Configuration (set these in your environment / .env):
//   RESEND_API_KEY   - your Resend API key (starts with "re_")
//   NOTIFY_FROM_EMAIL - the verified "from" address, e.g. "SheffMsg <hi@sheffmsg.fun>"
//
// If RESEND_API_KEY is not set we log a warning and skip sending (so local dev
// still works) — but we never silently swallow a *configured* send failure.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Send the "someone left a message via your QR" notification.
 * Returns true if an email was actually dispatched, false if skipped.
 */
export async function sendReferralNotification({ to, message }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL || 'SheffMsg <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping notification email to', to);
    return false;
  }

  const safeMessage = escapeHtml(message);
  const subject = 'Someone used your SheffMsg QR code!';
  const text = `Someone used a QR code you put up and left the message: ${message}`;
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;">` +
    `<p>Someone used a QR code you put up and left the message:</p>` +
    `<blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #6ee7b7;background:#f7f7f7;border-radius:8px;font-weight:600;">` +
    `${safeMessage}</blockquote>` +
    `<p style="color:#666;font-size:13px;">— SheffMsg · sheffmsg.fun</p>` +
    `</div>`;

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, text, html })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
  return true;
}

/**
 * Send the "thanks for helping" welcome email when someone registers, with their
 * personal QR attached as a PNG so they can print it later (handy since most
 * people register on their phone).
 *
 * @param {object} opts
 * @param {string} opts.to           recipient email
 * @param {string} opts.url          the sheffmsg.fun/<code> link the QR encodes
 * @param {string} opts.qrPngBase64  the QR image as base64 PNG (no data: prefix)
 * @returns {Promise<boolean>} true if dispatched, false if skipped
 */
export async function sendWelcomeEmail({ to, url, qrPngBase64 }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL || 'SheffMsg <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not set — skipping welcome email to', to);
    return false;
  }

  const subject = 'Thanks for helping spread the cause 💚';
  const safeUrl = escapeHtml(url);
  const text =
    `Thank you for helping spread the cause!\n\n` +
    `Your personal QR code is attached to this email as a PNG — print it onto ` +
    `stickers and put them up wherever you like.\n\n` +
    `It links to: ${url}\n\n` +
    `Whenever someone scans it and leaves a message, we'll email you. Happy sticking!\n— SheffMsg`;
  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;">` +
    `<h2 style="margin:0 0 12px;">Thanks for helping spread the cause 💚</h2>` +
    `<p>Your personal QR code is <strong>attached to this email as a PNG</strong> — print it onto stickers and put them up wherever you like.</p>` +
    `<p style="margin:16px 0;">It links to: <a href="${safeUrl}" style="color:#0a7d55;font-weight:700;">${safeUrl}</a></p>` +
    `<p>Whenever someone scans it and leaves a message, we'll email you. Happy sticking!</p>` +
    `<p style="color:#666;font-size:13px;">— SheffMsg · sheffmsg.fun</p>` +
    `</div>`;

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html,
      attachments: [{ filename: 'sheffmsg-qr.png', content: qrPngBase64 }]
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
  return true;
}

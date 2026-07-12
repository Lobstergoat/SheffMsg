// Supabase Edge Function: referral-mailer
//
// Handles the two referral emails for SheffMsg. Called from the browser:
//   { action: "welcome", code, email, qrPng }  -> "thanks for helping" + QR attached
//   { action: "notify",  code, message }        -> tells the code's owner about a message
//
// Secrets required (set with `supabase secrets set ...`):
//   RESEND_API_KEY     - your Resend API key (re_...)
//   NOTIFY_FROM_EMAIL  - verified sender, e.g. "SheffMsg <hi@sheffmsg.fun>"
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.
//
// Deploy:  supabase functions deploy referral-mailer

const RESEND_ENDPOINT = "https://api.resend.com/emails";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

async function sendEmail(payload: Record<string, unknown>): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("NOTIFY_FROM_EMAIL") || "SheffMsg <onboarding@resend.dev>";
  if (!apiKey) {
    console.warn("[referral-mailer] RESEND_API_KEY not set — skipping send");
    return false;
  }
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, ...payload }),
  });
  if (!res.ok) {
    console.error("[referral-mailer] Resend error", res.status, await res.text().catch(() => ""));
    return false;
  }
  return true;
}

// Look up an owner's email by code using the service role (bypasses RLS).
async function lookupEmail(code: string): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const res = await fetch(
    `${url}/rest/v1/referrals?code=eq.${encodeURIComponent(code)}&select=email`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  return rows?.[0]?.email ?? null;
}

const CODE_RE = /^[A-Za-z0-9]{6,10}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const action = body?.action;
  const code = body?.code;
  if (!CODE_RE.test(code || "")) return json({ error: "Invalid code" }, 400);

  if (action === "welcome") {
    const email = String(body?.email || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Invalid email" }, 400);
    const url = `https://sheffmsg.fun/${code}`;
    const attachments: unknown[] = [];
    const qrPng = String(body?.qrPng || "");
    const b64 = qrPng.includes(",") ? qrPng.split(",")[1] : "";
    if (b64) attachments.push({ filename: "sheffmsg-qr.png", content: b64 });

    const sent = await sendEmail({
      to: email,
      subject: "Thanks for helping spread the cause 💚",
      text:
        `Thank you for helping spread the cause!\n\n` +
        `Your personal QR code is attached as a PNG — print it onto stickers and put ` +
        `them up wherever you like.\n\nIt links to: ${url}\n\n` +
        `Whenever someone scans it and leaves a message, we'll email you. Happy sticking!\n— SheffMsg`,
      html:
        `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;">` +
        `<h2 style="margin:0 0 12px;">Thanks for helping spread the cause 💚</h2>` +
        `<p>Your personal QR code is <strong>attached as a PNG</strong> — print it onto stickers and put them up wherever you like.</p>` +
        `<p style="margin:16px 0;">It links to: <a href="${escapeHtml(url)}" style="color:#0a7d55;font-weight:700;">${escapeHtml(url)}</a></p>` +
        `<p>Whenever someone scans it and leaves a message, we'll email you. Happy sticking!</p>` +
        `<p style="color:#666;font-size:13px;">— SheffMsg · sheffmsg.fun</p></div>`,
      attachments,
    });
    return json({ sent });
  }

  if (action === "notify") {
    const message = String(body?.message || "").trim();
    if (!message) return json({ error: "Missing message" }, 400);
    const email = await lookupEmail(code);
    if (!email) return json({ sent: false }); // no owner / not registered
    const safe = escapeHtml(message);
    const sent = await sendEmail({
      to: email,
      subject: "Someone used your SheffMsg QR code!",
      text: `Someone used a QR code you put up and left the message: ${message}`,
      html:
        `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:16px;line-height:1.5;">` +
        `<p>Someone used a QR code you put up and left the message:</p>` +
        `<blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #6ee7b7;background:#f7f7f7;border-radius:8px;font-weight:600;">${safe}</blockquote>` +
        `<p style="color:#666;font-size:13px;">— SheffMsg · sheffmsg.fun</p></div>`,
    });
    return json({ sent });
  }

  return json({ error: "Unknown action" }, 400);
});

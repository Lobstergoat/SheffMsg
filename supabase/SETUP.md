# Referral feature — Supabase setup

The live site is a static site (GitHub Pages) that talks directly to Supabase, so
the referral feature runs client-side + a Supabase Edge Function for email. Follow
these steps.

## 1. Create the table (required — do this before deploying)

Supabase dashboard → **SQL Editor** → paste the contents of [`schema.sql`](./schema.sql) → **Run**.

This creates the `referrals` table (with Row Level Security so emails stay private)
and adds a nullable `code` column to `messages` for attribution.

Until this runs, the "Notify me" form on `/spread` will show *"Could not save your
email"* (the QR itself still generates and displays fine).

## 2. Deploy the site

Push to `main` as usual. The new/changed files:

- `public/spread.html`, `public/spread.js` — the personal-QR page (client-side QR)
- `public/qrcode-generator.js` — vendored QR library (self-hosted, MIT)
- `public/supabase-config.js` — now also exposes the URL/key for the function call
- `public/index.html`, `public/index.js` — footer link, referral code detection,
  notify call, and a path-restore script
- `public/404.html` — makes `sheffmsg.fun/<code>` load the message page on the
  static host (GitHub Pages serves 404.html for unknown paths; it bounces to the
  root which restores the real URL). **Verify a personal QR link opens the message
  page after deploy.**

## 3. Email notifications (do when you have a Resend key)

Emails are sent by the Edge Function in [`functions/referral-mailer`](./functions/referral-mailer/index.ts).
Until it's deployed, everything else works — emails are simply skipped.

Prerequisite: [Supabase CLI](https://supabase.com/docs/guides/cli) installed and
`supabase login` done.

```bash
# from the repo root, link once:
supabase link --project-ref iazdjfenbrzyndprqzfp

# set secrets (get the API key from https://resend.com/api-keys):
supabase secrets set RESEND_API_KEY=re_xxxxxxxx
supabase secrets set NOTIFY_FROM_EMAIL="SheffMsg <hi@sheffmsg.fun>"

# deploy the function (public, so the browser can call it):
supabase functions deploy referral-mailer --no-verify-jwt
```

Notes:
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — don't set them.
- For a quick test before verifying a domain, use `NOTIFY_FROM_EMAIL="SheffMsg <onboarding@resend.dev>"`.
  Resend only delivers to *your own* account address until you verify `sheffmsg.fun`.
- `--no-verify-jwt` lets the page call the function with the public anon key. The
  function only reads an email by code (server-side) and sends mail — it never
  exposes data back to the caller.

## What each email is

- **Welcome** (`action: "welcome"`): sent when someone submits their email on
  `/spread`; includes their QR as a printable PNG attachment.
- **Notify** (`action: "notify"`): sent when someone leaves a message via a
  personal QR; contains the message text.

## Not included (by request)

No leaderboard / points / gamification. The `referrals` table is deliberately
minimal but structured so those can be added later.

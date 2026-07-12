-- SheffMsg referral feature — run this once in the Supabase SQL editor.
-- (Dashboard → SQL Editor → paste → Run.)

-- 1. Personal referral codes. Each code is unique and permanent, and links to the
--    owner's email so they can be notified. Kept minimal but structured so a
--    leaderboard / points can be layered on later without reworking it.
create table if not exists public.referrals (
  code         text primary key,
  email        text not null,
  created_at   timestamptz not null default now(),
  email_set_at timestamptz
);

alter table public.referrals enable row level security;

-- Anonymous visitors (the browser, using the publishable key) may create their
-- OWN referral row when they submit their email. They cannot read, update, or
-- delete rows — so registered emails stay private and existing codes can't be
-- hijacked or overwritten. The Edge Function uses the service-role key, which
-- bypasses RLS, to look up an owner's email when sending notifications.
drop policy if exists "anon can create referral" on public.referrals;
create policy "anon can create referral"
  on public.referrals
  for insert
  to anon
  with check (email is not null);

-- 2. Attribute messages to the QR they were left through. Nullable, so the plain
--    root feed and all existing rows keep working exactly as before.
alter table public.messages add column if not exists code text;

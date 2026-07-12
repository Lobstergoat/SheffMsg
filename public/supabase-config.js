// Supabase project config. The publishable/anon key is safe to expose in the
// browser (Row Level Security governs what it can do). Kept on window so other
// scripts (spread.js) can build the Edge Function URL for referral emails.
window.SHEFFMSG_SUPABASE_URL = 'https://iazdjfenbrzyndprqzfp.supabase.co';
window.SHEFFMSG_SUPABASE_KEY = 'sb_publishable_NghTZp5i0CXoC0d0jHpFjA_6ze8fUf0';

window.sheffmsgSupabase = window.supabase.createClient(
  window.SHEFFMSG_SUPABASE_URL,
  window.SHEFFMSG_SUPABASE_KEY
);

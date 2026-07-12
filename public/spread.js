// Personal QR page — runs entirely in the browser against Supabase (matches the
// live static hosting). The unique code is generated client-side and the QR is
// drawn locally; the code is persisted to Supabase only when the visitor submits
// their email, so it becomes permanently linked to them.

const qrImage = document.getElementById('qrImage');
const qrUrlEl = document.getElementById('qrUrl');
const copyBtn = document.getElementById('copyBtn');
const emailForm = document.getElementById('emailForm');
const emailInput = document.getElementById('emailInput');
const emailStatus = document.getElementById('emailStatus');

const sb = window.sheffmsgSupabase;
const STORAGE_KEY = 'sheffmsg_referral_code';
// Unambiguous alphabet (no 0/o/1/l/i). Matches the 6-10 alnum route on the site.
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

let currentCode = null;
let currentUrl = null;
let currentQrPng = null;

function generateCode(len = 8) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// Draw the QR to a canvas so we get a crisp PNG data URL (good for printing and
// for attaching to the welcome email later).
function makeQrPng(text, size = 460, margin = 4) {
  const qr = window.qrcode(0, 'H'); // 0 = auto-size, H = highest error correction
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const cell = Math.max(1, Math.floor(size / (count + margin * 2)));
  const dim = cell * (count + margin * 2);
  const canvas = document.createElement('canvas');
  canvas.width = dim;
  canvas.height = dim;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dim, dim);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    }
  }
  return canvas.toDataURL('image/png');
}

function render(code) {
  currentCode = code;
  currentUrl = `${location.origin}/${code}`;
  localStorage.setItem(STORAGE_KEY, code);
  try {
    currentQrPng = makeQrPng(currentUrl);
    qrImage.src = currentQrPng;
    qrImage.alt = `QR code for ${currentUrl}`;
  } catch (e) {
    qrUrlEl.textContent = 'Could not render the QR code. Please refresh.';
    return;
  }
  qrUrlEl.textContent = currentUrl;
}

function loadCode() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const code = saved && /^[A-Za-z0-9]{6,10}$/.test(saved) ? saved : generateCode();
  render(code);
}

copyBtn.addEventListener('click', async () => {
  if (!currentUrl) return;
  try {
    await navigator.clipboard.writeText(currentUrl);
    copyBtn.textContent = 'Copied!';
  } catch {
    copyBtn.textContent = 'Copy failed';
  }
  setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1500);
});

// Fire-and-forget welcome email via the Supabase Edge Function. Degrades quietly
// if the function isn't deployed yet (e.g. before the Resend key is set up).
async function sendWelcome(code, email) {
  try {
    const res = await fetch(`${window.SHEFFMSG_SUPABASE_URL}/functions/v1/referral-mailer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: window.SHEFFMSG_SUPABASE_KEY,
        Authorization: `Bearer ${window.SHEFFMSG_SUPABASE_KEY}`
      },
      body: JSON.stringify({ action: 'welcome', code, email, qrPng: currentQrPng })
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return !!data.sent;
  } catch {
    return false;
  }
}

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentCode) { emailStatus.textContent = 'Still preparing your code, one sec…'; return; }
  const email = emailInput.value.trim();
  if (!email) return;
  if (!sb) { emailStatus.textContent = 'Something went wrong loading the page. Please refresh.'; return; }

  emailStatus.textContent = 'Saving…';
  const { error } = await sb.from('referrals').insert({
    code: currentCode,
    email,
    created_at: new Date().toISOString()
  });

  if (error) {
    // 23505 = unique violation: this code is already registered.
    if (error.code === '23505') {
      emailStatus.textContent = "This QR is already registered — you're all set!";
    } else {
      console.error(error);
      emailStatus.textContent = 'Could not save your email. Please try again.';
    }
    return;
  }

  emailStatus.textContent = "You're all set! We'll email you when someone leaves a message.";
  const welcomed = await sendWelcome(currentCode, email);
  if (welcomed) {
    emailStatus.textContent = "You're all set! Check your inbox — we've emailed your QR to print. We'll also email you when someone leaves a message.";
  }
});

loadCode();

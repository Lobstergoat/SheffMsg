const qrImage = document.getElementById('qrImage');
const qrUrlEl = document.getElementById('qrUrl');
const copyBtn = document.getElementById('copyBtn');
const emailForm = document.getElementById('emailForm');
const emailInput = document.getElementById('emailInput');
const emailStatus = document.getElementById('emailStatus');

const STORAGE_KEY = 'sheffmsg_referral_code';
let currentCode = null;
let currentUrl = null;

function render(data) {
  currentCode = data.code;
  currentUrl = data.url;
  qrImage.src = data.qrDataUrl;
  qrUrlEl.textContent = data.url;
  localStorage.setItem(STORAGE_KEY, data.code);
  if (data.hasEmail) {
    emailStatus.textContent = "You're already signed up for notifications on this code.";
  }
}

// Reuse the visitor's existing code if they've been here before, otherwise make
// a fresh, permanent one. The code exists forever once created.
async function loadCode() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && /^[A-Za-z0-9]{6,10}$/.test(saved)) {
    try {
      const res = await fetch(`/api/referral/${saved}`);
      if (res.ok) { render(await res.json()); return; }
    } catch { /* fall through to creating a new one */ }
  }
  try {
    const res = await fetch('/api/referral/new');
    if (!res.ok) throw new Error('failed');
    render(await res.json());
  } catch {
    qrUrlEl.textContent = 'Could not generate a code. Please refresh.';
  }
}

copyBtn.addEventListener('click', async () => {
  if (!currentUrl) return;
  try {
    await navigator.clipboard.writeText(currentUrl);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1500);
  } catch {
    copyBtn.textContent = 'Copy failed';
    setTimeout(() => { copyBtn.textContent = 'Copy link'; }, 1500);
  }
});

emailForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentCode) { emailStatus.textContent = 'Still preparing your code, one sec…'; return; }
  const email = emailInput.value.trim();
  if (!email) return;
  emailStatus.textContent = 'Saving…';
  try {
    const res = await fetch(`/api/referral/${currentCode}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();
    if (!res.ok) { emailStatus.textContent = data.error || 'Could not save your email'; return; }
    emailStatus.textContent = data.emailed
      ? "You're all set! Check your inbox — we've emailed your QR code to print. We'll also email you when someone leaves a message."
      : "You're all set! We'll email you when someone leaves a message.";
  } catch {
    emailStatus.textContent = 'Network error, please try again.';
  }
});

loadCode();

import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import basicAuth from 'basic-auth';
import path from 'path';
import crypto from 'crypto';
import cors from 'cors';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import { getDb, migrate } from './db.js';
import { sendReferralNotification, sendWelcomeEmail } from './email.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const nodeEnv = process.env.NODE_ENV || 'development';

// Security headers with a restrictive CSP
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", 'data:'],
      "connect-src": ["'self'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"]
    }
  }
}));

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
if (allowedOrigins.length > 0) {
  app.use(cors({ origin: allowedOrigins }));
}

app.use(express.json({ limit: '10kb' }));

migrate();
const db = getDb();

const SINGLE_FEED_LOCATION = 'default';

function validateMessage(raw) {
  if (typeof raw !== 'string') return { ok: false, error: 'Message must be a string' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: false, error: 'Message cannot be empty' };
  if (trimmed.length > 100) return { ok: false, error: 'Message too long (max 100 chars)' };
  return { ok: true, value: trimmed };
}

const ALLOWED_BG = [
  '#a6ff9d', '#fbffad', '#3ebfcd', '#973ecd', '#cd3ec1', '#cd763e', '#ff0020' , '#0500ff'
];
const ALLOWED_FONT = [
  'system-ui', 'serif', 'monospace', 'cursive', 'fantasy', 'Georgia', 'Times New Roman', 'Arial'
];
const ALLOWED_SIZE = ['small', 'medium', 'large'];

function validateBgColor(raw) {
  const v = String(raw || '').toLowerCase();
  return ALLOWED_BG.includes(v) ? v : null;
}
function validateFont(raw) {
  const v = String(raw || 'system-ui');
  return ALLOWED_FONT.includes(v) ? v : 'system-ui';
}
function validateSize(raw) {
  const v = String(raw || 'medium');
  return ALLOWED_SIZE.includes(v) ? v : 'medium';
}

const postLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

const referralLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

// Public base URL used when encoding personal QR codes (no trailing slash).
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, '');

// Personal referral codes: 8 chars, unreserved alphabet. The catch-all route and
// the client both accept 6-10 alphanumeric chars, keeping older codes valid forever.
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no ambiguous 0/o/1/i/l
const CODE_RE = /^[A-Za-z0-9]{6,10}$/;
// Single-segment paths that must never be treated as a referral code.
const RESERVED_CODES = new Set(['spread', 'admin', 'api', 'healthz', 'messages', 'index', 'styles', 'favicon']);

function generateCode(len = 8) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// Create a brand-new, guaranteed-unique referral code row (email unbound).
function createReferralCode() {
  const nowIso = new Date().toISOString();
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    try {
      db.prepare('INSERT INTO referrals (code, email, created_at) VALUES (?, NULL, ?)').run(code, nowIso);
      return code;
    } catch (e) {
      // UNIQUE collision — try again with a fresh code.
      if (String(e.message).includes('UNIQUE')) continue;
      throw e;
    }
  }
  throw new Error('Could not allocate a unique referral code');
}

function referralUrl(code) {
  return `${PUBLIC_BASE_URL}/${code}`;
}

function qrDataUrl(code) {
  return QRCode.toDataURL(referralUrl(code), { errorCorrectionLevel: 'H', margin: 2, width: 420 });
}

function validateEmail(raw) {
  const v = String(raw || '').trim();
  if (v.length === 0) return { ok: false, error: 'Email is required' };
  if (v.length > 254) return { ok: false, error: 'Email too long' };
  // Deliberately simple: one @, something either side, a dot in the domain.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return { ok: false, error: 'Please enter a valid email' };
  return { ok: true, value: v.toLowerCase() };
}

// Static files
const publicDir = path.join(process.cwd(), 'public');
app.use(express.static(publicDir));

// API: get latest message (single feed)
app.get('/api/message', (req, res) => {
  const location = SINGLE_FEED_LOCATION;
  const row = db.prepare(
    'SELECT id, message, created_at, bg_color, font_family, text_size FROM messages WHERE location = ? ORDER BY created_at DESC, id DESC LIMIT 1'
  ).get(location);
  res.json({
    message: row ? row.message : null,
    createdAt: row ? row.created_at : null,
    style: row ? {
      bgColor: row.bg_color || null,
      fontFamily: row.font_family || 'system-ui',
      textSize: row.text_size || 'medium'
    } : null
  });
});

// API: get all messages (for grid view)
app.get('/api/messages/all', (req, res) => {
  const location = SINGLE_FEED_LOCATION;
  const rows = db.prepare(
    'SELECT id, message, created_at, bg_color, font_family, text_size FROM messages WHERE location = ? ORDER BY created_at DESC, id DESC'
  ).all(location);
  res.json({ messages: rows });
});

// API: post a new message (single feed)
app.post('/api/message', postLimiter, (req, res) => {
  const location = SINGLE_FEED_LOCATION;
  const validation = validateMessage(req.body?.message);
  if (!validation.ok) {
    return res.status(400).json({ error: validation.error });
  }
  const bg = validateBgColor(req.body?.bgColor);
  const font = validateFont(req.body?.fontFamily);
  const size = validateSize(req.body?.textSize);
  const nowIso = new Date().toISOString();
  db.prepare('INSERT INTO messages (location, message, created_at, bg_color, font_family, text_size) VALUES (?, ?, ?, ?, ?, ?)')
    .run(location, validation.value, nowIso, bg, font, size);

  // If this message was left via a personal referral QR (sheffmsg.fun/<code>),
  // notify the code's owner. Never let email issues affect the message flow.
  const rawCode = req.body?.code;
  if (typeof rawCode === 'string' && CODE_RE.test(rawCode)) {
    const owner = db.prepare('SELECT email FROM referrals WHERE code = ?').get(rawCode);
    if (owner && owner.email) {
      sendReferralNotification({ to: owner.email, message: validation.value })
        .catch((err) => console.error('[email] notification failed:', err.message));
    }
  }

  res.status(201).json({ ok: true, createdAt: nowIso, style: { bgColor: bg, fontFamily: font, textSize: size } });
});

// --- Personal referral QR endpoints ---

// Generate a brand-new personal code (email not yet bound) + its QR image.
app.get('/api/referral/new', referralLimiter, async (req, res) => {
  try {
    const code = createReferralCode();
    const qr = await qrDataUrl(code);
    res.json({ code, url: referralUrl(code), qrDataUrl: qr, hasEmail: false });
  } catch (e) {
    res.status(500).json({ error: 'Could not create a code, please try again' });
  }
});

// Fetch an existing code (so a returning visitor keeps the same QR).
app.get('/api/referral/:code', referralLimiter, async (req, res) => {
  const code = req.params.code;
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'Invalid code' });
  const row = db.prepare('SELECT code, email FROM referrals WHERE code = ?').get(code);
  if (!row) return res.status(404).json({ error: 'Code not found' });
  try {
    const qr = await qrDataUrl(row.code);
    res.json({ code: row.code, url: referralUrl(row.code), qrDataUrl: qr, hasEmail: !!row.email });
  } catch (e) {
    res.status(500).json({ error: 'Could not render QR' });
  }
});

// Bind an email to an existing code so the owner gets notified, and email them
// their personal QR (as a PNG attachment) to print later.
app.post('/api/referral/:code/email', referralLimiter, async (req, res) => {
  const code = req.params.code;
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'Invalid code' });
  const row = db.prepare('SELECT code FROM referrals WHERE code = ?').get(code);
  if (!row) return res.status(404).json({ error: 'Code not found' });
  const emailCheck = validateEmail(req.body?.email);
  if (!emailCheck.ok) return res.status(400).json({ error: emailCheck.error });
  db.prepare('UPDATE referrals SET email = ?, email_set_at = ? WHERE code = ?')
    .run(emailCheck.value, new Date().toISOString(), code);

  // Send the "thanks for helping" email with the QR attached. We await so the
  // UI can tell the user whether it went out, but a failure never blocks signup.
  let emailed = false;
  try {
    const qrPngBase64 = (await qrDataUrl(code)).split(',')[1];
    emailed = await sendWelcomeEmail({ to: emailCheck.value, url: referralUrl(code), qrPngBase64 });
  } catch (err) {
    console.error('[email] welcome email failed:', err.message);
  }
  res.json({ ok: true, emailed });
});

// Admin basic auth middleware
function adminAuth(req, res, next) {
  const creds = basicAuth(req);
  const user = process.env.ADMIN_USER || 'admin';
  const pass = process.env.ADMIN_PASS || 'changeme';
  if (!creds || creds.name !== user || creds.pass !== pass) {
    res.set('WWW-Authenticate', 'Basic realm="Admin"');
    return res.status(401).send('Authentication required');
  }
  return next();
}

// Admin UI and APIs
app.get('/admin', adminAuth, (req, res) => {
  res.sendFile(path.join(publicDir, 'admin.html'));
});

app.get('/api/admin/messages', adminAuth, (req, res) => {
  // Single feed only
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const offset = (page - 1) * limit;

  let rows;
  let totalCount;
  rows = db.prepare(
    'SELECT id, location, message, created_at, bg_color, font_family, text_size FROM messages WHERE location = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?'
  ).all(SINGLE_FEED_LOCATION, limit, offset);
  totalCount = db.prepare('SELECT COUNT(*) as c FROM messages WHERE location = ?').get(SINGLE_FEED_LOCATION).c;
  res.json({ page, limit, total: totalCount, items: rows });
});

app.delete('/api/admin/messages/:id', adminAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  const info = db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  res.json({ ok: true, deleted: info.changes });
});

app.get('/healthz', (req, res) => {
  res.json({ status: 'ok', env: nodeEnv });
});

// The "Help spread the cause" page where visitors get their personal QR.
app.get('/spread', (req, res) => {
  res.sendFile(path.join(publicDir, 'spread.html'));
});

// Personal QR landing: sheffmsg.fun/<code> serves the exact same message page as
// the root. It functions identically — index.js reads the code from the URL and
// attaches it to the message POST so the code's owner gets notified. Static files
// and all routes above are matched first, so nothing existing is affected.
app.get('/:code([A-Za-z0-9]{6,10})', (req, res, next) => {
  if (RESERVED_CODES.has(req.params.code.toLowerCase())) return next();
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${port}`);
});



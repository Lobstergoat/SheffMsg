import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import basicAuth from 'basic-auth';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDb, migrate } from './db.js';

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
  '#a6ff9d', '#fbffad', '#3ebfcd', '#973ecd', '#cd3ec1', '#cd763e'
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
  res.status(201).json({ ok: true, createdAt: nowIso, style: { bgColor: bg, fontFamily: font, textSize: size } });
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

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${port}`);
});



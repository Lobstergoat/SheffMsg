import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'messages.db');

export function getDb() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return db;
}

export function migrate() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      bg_color TEXT,
      font_family TEXT,
      text_size TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_messages_location_created_at
      ON messages (location, created_at DESC);
  `);
  // In case table existed without new columns, try to add them (ignore failures)
  try { db.exec('ALTER TABLE messages ADD COLUMN bg_color TEXT'); } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN font_family TEXT'); } catch {}
  try { db.exec('ALTER TABLE messages ADD COLUMN text_size TEXT'); } catch {}
}

// CLI usage: `node src/db.js migrate`
if (process.argv[2] === 'migrate') {
  migrate();
  // eslint-disable-next-line no-console
  console.log('Database migrated at', dbPath);
}

// CLI usage: `node src/db.js clear`
if (process.argv[2] === 'clear') {
  const db = getDb();
  const count = db.prepare('DELETE FROM messages').run().changes;
  // Reset the AUTOINCREMENT sequence counter so IDs start from 1
  try {
    db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run('messages');
  } catch (e) {
    // If sqlite_sequence doesn't exist or fails, that's okay
  }
  // eslint-disable-next-line no-console
  console.log(`Cleared ${count} message(s) from database. ID counter reset.`);
}



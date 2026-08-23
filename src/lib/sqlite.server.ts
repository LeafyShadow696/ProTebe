import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDir = process.env["DATA_DIR"] || "/data";
const databasePath = process.env["DATABASE_PATH"] || join(dataDir, "protebe.sqlite");

let database: DatabaseSync | undefined;

export function getDatabase(): DatabaseSync {
  if (database) return database;
  mkdirSync(join(databasePath, ".."), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS pairs (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      owner_name TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      anniversary TEXT NOT NULL,
      owner_token TEXT NOT NULL UNIQUE,
      partner_token TEXT UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pair_sessions (
      id TEXT PRIMARY KEY,
      pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('owner', 'partner')),
      token_digest TEXT NOT NULL,
      created_via TEXT NOT NULL,
      created_via_invite_id TEXT,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      idle_expires_at TEXT NOT NULL,
      absolute_expires_at TEXT NOT NULL,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS pair_sessions_pair_id_idx ON pair_sessions(pair_id);
    CREATE INDEX IF NOT EXISTS pair_sessions_expires_idx ON pair_sessions(idle_expires_at, absolute_expires_at);
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
      author TEXT NOT NULL DEFAULT 'owner', body TEXT NOT NULL, reaction TEXT,
      pinned INTEGER NOT NULL DEFAULT 0, deliver_at TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS messages_pair_created_idx ON messages(pair_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY, pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
      storage_path TEXT NOT NULL, caption TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS photos_pair_created_idx ON photos(pair_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY, pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
      title TEXT NOT NULL, date TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_pair_date_idx ON events(pair_id, date);
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY, pair_id TEXT NOT NULL REFERENCES pairs(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE, secret_hash TEXT, expires_at TEXT, redeemed_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS invites_pair_idx ON invites(pair_id);
  `);
  return database;
}

export function closeDatabase(): void {
  database?.close();
  database = undefined;
}

export function dbNow(): string {
  return new Date().toISOString();
}

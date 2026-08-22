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

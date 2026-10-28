
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const databasePath =
  process.env.NODE_ENV === 'test'
    ? ':memory:'
    : process.env.PULSECHECK_DB_PATH ??
      resolve('data', 'pulsecheck.db');

if (databasePath !== ':memory:') {
  mkdirSync(dirname(databasePath), { recursive: true });
}

export const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS check_history (
    id TEXT PRIMARY KEY,
    monitor_id TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('up', 'down')),
    status_code INTEGER,
    response_time_ms INTEGER NOT NULL,
    error TEXT,
    FOREIGN KEY (monitor_id)
      REFERENCES monitors(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_check_history_monitor_checked_at
    ON check_history (monitor_id, checked_at);
`);

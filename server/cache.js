import Database from "better-sqlite3";
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";

let db = null;

function getDb() {
  if (db) return db;
  const dataDir = path.join(process.cwd(), "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, "snapshots.db"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (date, type)
    );
    CREATE TABLE IF NOT EXISTS dominance_history (
      date TEXT PRIMARY KEY,
      index_value INTEGER NOT NULL,
      breakdown TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function writeSnapshot(type, payload, date = today()) {
  getDb()
    .prepare("INSERT OR REPLACE INTO snapshots (date, type, payload) VALUES (?, ?, ?)")
    .run(date, type, JSON.stringify(payload));
}

export function readSnapshot(type, date = today()) {
  const row = getDb()
    .prepare("SELECT payload FROM snapshots WHERE date = ? AND type = ?")
    .get(date, type);
  return row ? JSON.parse(row.payload) : null;
}

export function readLatestSnapshot(type) {
  const row = getDb()
    .prepare("SELECT date, payload FROM snapshots WHERE type = ? ORDER BY date DESC LIMIT 1")
    .get(type);
  return row ? { date: row.date, payload: JSON.parse(row.payload) } : null;
}

export function readPreviousSnapshot(type, beforeDate) {
  const row = getDb()
    .prepare(
      "SELECT date, payload FROM snapshots WHERE type = ? AND date < ? ORDER BY date DESC LIMIT 1"
    )
    .get(type, beforeDate);
  return row ? { date: row.date, payload: JSON.parse(row.payload) } : null;
}

export function listSnapshotDates(type, limit = 12) {
  return getDb()
    .prepare("SELECT date FROM snapshots WHERE type = ? ORDER BY date DESC LIMIT ?")
    .all(type, limit)
    .map((r) => r.date);
}

export function recordDominance({ index, breakdown }, date = today()) {
  getDb()
    .prepare("INSERT OR REPLACE INTO dominance_history (date, index_value, breakdown) VALUES (?, ?, ?)")
    .run(date, Math.round(index), JSON.stringify(breakdown));
}

export function dominanceHistory(days = 30) {
  // NB: `index` is a reserved word in SQLite — must be double-quoted.
  // The client expects rows of { date, index } shape, so alias to "index".
  return getDb()
    .prepare(
      `SELECT date, index_value AS "index" FROM dominance_history WHERE date >= date('now', ?) ORDER BY date`
    )
    .all(`-${days} days`);
}

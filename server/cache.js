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
    CREATE TABLE IF NOT EXISTS briefings (
      date TEXT PRIMARY KEY,
      index_value INTEGER,
      status TEXT,
      content TEXT NOT NULL,
      model TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ai_visibility_responses (
      id INTEGER PRIMARY KEY,
      ts TEXT NOT NULL,
      week_start TEXT NOT NULL,
      prompt_id TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      engine TEXT NOT NULL,
      lang TEXT NOT NULL,
      brand_mentioned INTEGER NOT NULL DEFAULT 0,
      brand_cited INTEGER NOT NULL DEFAULT 0,
      competitors_mentioned TEXT NOT NULL DEFAULT '[]',
      sentiment TEXT,
      intent TEXT,
      response_hash TEXT NOT NULL,
      raw_excerpt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_avr_week ON ai_visibility_responses(week_start);
    CREATE INDEX IF NOT EXISTS idx_avr_prompt ON ai_visibility_responses(prompt_id, ts);
    CREATE INDEX IF NOT EXISTS idx_avr_engine ON ai_visibility_responses(engine, lang);
  `);
  return db;
}

export function weekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
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

export function recordBriefing(briefing, indexValue, status, date = today()) {
  const { model, usage, ...narrative } = briefing;
  getDb()
    .prepare(
      "INSERT OR REPLACE INTO briefings (date, index_value, status, content, model) VALUES (?, ?, ?, ?, ?)"
    )
    .run(date, indexValue, status, JSON.stringify(narrative), model || null);
}

export function readLatestBriefing() {
  const row = getDb()
    .prepare(
      "SELECT date, index_value, status, content, model FROM briefings ORDER BY date DESC LIMIT 1"
    )
    .get();
  if (!row) return null;
  return {
    date: row.date,
    index: row.index_value,
    status: row.status,
    model: row.model,
    ...JSON.parse(row.content),
  };
}

export function writeAiResponses(rows) {
  if (!rows?.length) return 0;
  const stmt = getDb().prepare(`
    INSERT INTO ai_visibility_responses
      (ts, week_start, prompt_id, prompt_text, engine, lang,
       brand_mentioned, brand_cited, competitors_mentioned,
       sentiment, intent, response_hash, raw_excerpt)
    VALUES (@ts, @week_start, @prompt_id, @prompt_text, @engine, @lang,
            @brand_mentioned, @brand_cited, @competitors_mentioned,
            @sentiment, @intent, @response_hash, @raw_excerpt)
  `);
  const insertMany = getDb().transaction((items) => {
    for (const item of items) stmt.run(item);
  });
  insertMany(rows);
  return rows.length;
}

export function readAiResponsesForWeek(week) {
  return getDb()
    .prepare("SELECT * FROM ai_visibility_responses WHERE week_start = ? ORDER BY engine, lang, prompt_id")
    .all(week);
}

export function findCachedResponse(promptId, engine, week) {
  return getDb()
    .prepare("SELECT * FROM ai_visibility_responses WHERE prompt_id = ? AND engine = ? AND week_start = ? LIMIT 1")
    .get(promptId, engine, week);
}

export function aiVisibilityHistory(weeks = 12) {
  return getDb()
    .prepare(`
      SELECT date, payload FROM snapshots
      WHERE type = 'ai-visibility-week'
      ORDER BY date DESC LIMIT ?
    `)
    .all(weeks)
    .map((r) => ({ date: r.date, ...JSON.parse(r.payload) }))
    .reverse();
}

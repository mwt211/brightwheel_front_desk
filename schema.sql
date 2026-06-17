-- Cloudflare D1 schema for the AI Front Desk prototype.
-- Idempotent: safe to re-run. The single kb row is seeded from seed/center.json
-- by the API on first read, so no large JSON literal lives here.

CREATE TABLE IF NOT EXISTS kb (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  json       TEXT    NOT NULL,
  version    INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at       TEXT    NOT NULL,
  text             TEXT    NOT NULL,
  answer           TEXT    NOT NULL DEFAULT '',
  confidence       TEXT    NOT NULL DEFAULT 'low',
  category         TEXT    NOT NULL DEFAULT 'other',
  status           TEXT    NOT NULL DEFAULT 'answered',
  needs_human      INTEGER NOT NULL DEFAULT 0,
  escalation_reason TEXT,
  citations        TEXT    NOT NULL DEFAULT '[]',
  feedback         TEXT
);

CREATE INDEX IF NOT EXISTS idx_questions_created ON questions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_status  ON questions (status);

CREATE TABLE IF NOT EXISTS requests (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at          TEXT    NOT NULL,
  kind                TEXT    NOT NULL,
  name                TEXT    NOT NULL DEFAULT '',
  contact             TEXT    NOT NULL DEFAULT '',
  message             TEXT    NOT NULL DEFAULT '',
  related_question_id INTEGER,
  urgent              INTEGER NOT NULL DEFAULT 0,
  handled             INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS kb_history (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  summary    TEXT NOT NULL
);

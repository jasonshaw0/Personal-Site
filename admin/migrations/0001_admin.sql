CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  origin_path TEXT UNIQUE,
  base_sha TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  content TEXT NOT NULL,
  size INTEGER NOT NULL,
  public_path TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  outcome TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_date ON audit(created_at DESC);
CREATE TABLE IF NOT EXISTS operations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  actor TEXT NOT NULL,
  state TEXT NOT NULL,
  result TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS operations_busy ON operations(kind,target) WHERE state='pending';

-- قاعدة بيانات «باحث» (Cloudflare D1): المستخدمون والمفضلة والحصة اليومية
CREATE TABLE IF NOT EXISTS users (
  sub        TEXT PRIMARY KEY,      -- المعرّف الثابت من Google
  email      TEXT NOT NULL,
  name       TEXT,
  picture    TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  user_sub   TEXT NOT NULL,
  paper_id   TEXT NOT NULL,
  data       TEXT NOT NULL,         -- JSON منقّى لبيانات الورقة
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_sub, paper_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites (user_sub, created_at DESC);

CREATE TABLE IF NOT EXISTS usage (
  user_sub TEXT NOT NULL,
  day      TEXT NOT NULL,           -- YYYY-MM-DD (UTC)
  kind     TEXT NOT NULL,           -- web | ai
  count    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_sub, day, kind)
);

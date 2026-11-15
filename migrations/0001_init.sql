-- tomaja: gardens, sessions and synced learning progress (plan §8.1)
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  rev         INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE item_state (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id     TEXT NOT NULL,
  state       TEXT NOT NULL,
  last_review INTEGER NOT NULL,
  rev         INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX item_state_rev ON item_state(user_id, rev);
CREATE TABLE days (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,
  rev         INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
);
CREATE INDEX days_rev ON days(user_id, rev);
CREATE TABLE profile (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        TEXT NOT NULL,
  updated_at  INTEGER NOT NULL,
  rev         INTEGER NOT NULL
);
CREATE TABLE attempts (
  key          TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL
);

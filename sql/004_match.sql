-- 次元匹配：住民坐标 / 爱好，以及心动记录

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS city TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS district TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS hobbies TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS match_likes (
  viewer_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (viewer_id, target_id),
  CHECK (viewer_id <> target_id)
);

CREATE INDEX IF NOT EXISTS idx_match_likes_viewer ON match_likes (viewer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users (last_seen_at DESC);

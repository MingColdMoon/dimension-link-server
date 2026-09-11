-- 群聊：会话可多人，直聊仍保留 user_low / user_high。

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE conversations ALTER COLUMN user_low DROP NOT NULL;
ALTER TABLE conversations ALTER COLUMN user_high DROP NOT NULL;

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_kind_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_kind_check CHECK (kind IN ('direct', 'group'));

CREATE TABLE IF NOT EXISTS conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

INSERT INTO conversation_members (conversation_id, user_id)
SELECT id, user_low FROM conversations WHERE user_low IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO conversation_members (conversation_id, user_id)
SELECT id, user_high FROM conversations WHERE user_high IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE notices DROP CONSTRAINT IF EXISTS notices_kind_check;
ALTER TABLE notices ADD CONSTRAINT notices_kind_check
  CHECK (kind IN ('badge', 'star', 'circle', 'like', 'follow', 'comment', 'group'));

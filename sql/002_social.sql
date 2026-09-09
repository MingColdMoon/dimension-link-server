-- 切换为次元链接社交模型（替换早期 dimensions 占位表）

DROP TABLE IF EXISTS dimension_links CASCADE;
DROP TABLE IF EXISTS dimensions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  handle TEXT NOT NULL,
  handle_normalized TEXT NOT NULL UNIQUE,
  bio TEXT NOT NULL,
  signature TEXT NOT NULL,
  emoji TEXT NOT NULL,
  accent_index INT NOT NULL CHECK (accent_index BETWEEN 0 AND 7),
  followers INT NOT NULL DEFAULT 0 CHECK (followers >= 0),
  following INT NOT NULL DEFAULT 0 CHECK (following >= 0),
  level INT NOT NULL DEFAULT 1,
  badges TEXT[] NOT NULL DEFAULT '{}',
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_nickname_lower ON users (LOWER(nickname));

CREATE TABLE circles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT NOT NULL,
  member_count INT NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  accent_index INT NOT NULL CHECK (accent_index BETWEEN 0 AND 7),
  tags TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE circle_members (
  circle_id TEXT NOT NULL REFERENCES circles (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  followee_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('happy', 'excited', 'sleepy', 'love', 'sad', 'fire')),
  circle_id TEXT NOT NULL REFERENCES circles (id),
  image_hue INT NOT NULL CHECK (image_hue BETWEEN 0 AND 359),
  image_title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_created ON posts (created_at DESC, id DESC);
CREATE INDEX idx_posts_author ON posts (author_id, created_at DESC);
CREATE INDEX idx_posts_circle ON posts (circle_id, created_at DESC);

CREATE TABLE post_likes (
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE post_stars (
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_post ON comments (post_id, created_at ASC, id ASC);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  user_low TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  user_high TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_low, user_high),
  CHECK (user_low < user_high)
);

CREATE TABLE conversation_unreads (
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  unread INT NOT NULL DEFAULT 0 CHECK (unread >= 0),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conv ON messages (conversation_id, created_at ASC, id ASC);

CREATE TABLE notices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('badge', 'star', 'circle', 'like', 'follow', 'comment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notices_user ON notices (user_id, created_at DESC, id DESC);

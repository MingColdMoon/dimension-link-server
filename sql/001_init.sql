-- 初始化 Dimension Link 核心表结构

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dimensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(64) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

CREATE TABLE IF NOT EXISTS dimension_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_dimension_id UUID NOT NULL REFERENCES dimensions (id) ON DELETE CASCADE,
  to_dimension_id UUID NOT NULL REFERENCES dimensions (id) ON DELETE CASCADE,
  name VARCHAR(64) NOT NULL,
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (from_dimension_id, to_dimension_id),
  CHECK (from_dimension_id <> to_dimension_id)
);

CREATE INDEX IF NOT EXISTS idx_dimensions_owner ON dimensions (owner_id);
CREATE INDEX IF NOT EXISTS idx_links_from ON dimension_links (from_dimension_id);
CREATE INDEX IF NOT EXISTS idx_links_to ON dimension_links (to_dimension_id);

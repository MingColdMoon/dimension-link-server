-- 群聊角色、禁言与图片消息

ALTER TABLE conversation_members
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE conversation_members DROP CONSTRAINT IF EXISTS conversation_members_role_check;
ALTER TABLE conversation_members
  ADD CONSTRAINT conversation_members_role_check CHECK (role IN ('owner', 'admin', 'member'));

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS muted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_kind_check;
ALTER TABLE messages
  ADD CONSTRAINT messages_kind_check CHECK (kind IN ('text', 'image', 'system'));

UPDATE conversation_members m
SET role = 'owner'
FROM conversations c
WHERE m.conversation_id = c.id
  AND c.kind = 'group'
  AND c.owner_id = m.user_id
  AND m.role <> 'owner';

-- 系统消息没有真实发送者，放开 messages.sender_id 的非空约束。
-- 外键仍在：有值时必须指向 users；NULL 表示系统提示。

ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;

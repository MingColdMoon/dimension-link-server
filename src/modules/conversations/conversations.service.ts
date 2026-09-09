import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { decodeCursor, paginate } from "../../common/cursor.js";
import { AppError, ErrorCode } from "../../common/errors.js";
import { toIso } from "../../common/http.js";
import { newId, pairUsers } from "../../common/ids.js";
import { hitRateLimit } from "../../middleware/rate-limit.js";
import type { ChatMessageItem, ConversationItem } from "../../types.js";
import { loadPublicMap, requireUser } from "../users/user.repo.js";

interface ConversationRow {
  id: string;
  user_low: string;
  user_high: string;
  created_at: Date;
  unread: number;
  last_id: string | null;
  last_sender_id: string | null;
  last_text: string | null;
  last_created_at: Date | null;
}

export class ConversationService {
  constructor(
    private readonly pg: Pool,
    private readonly redis: Redis,
  ) {}

  async list(viewerId: string): Promise<ConversationItem[]> {
    const result = await this.pg.query<ConversationRow>(
      `SELECT
         cv.id, cv.user_low, cv.user_high, cv.created_at,
         COALESCE(u.unread, 0) AS unread,
         m.id AS last_id, m.sender_id AS last_sender_id, m.text AS last_text, m.created_at AS last_created_at
       FROM conversations cv
       LEFT JOIN conversation_unreads u ON u.conversation_id = cv.id AND u.user_id = $1
       LEFT JOIN LATERAL (
         SELECT id, sender_id, text, created_at
         FROM messages
         WHERE conversation_id = cv.id
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       ) m ON true
       WHERE cv.user_low = $1 OR cv.user_high = $1
       ORDER BY COALESCE(m.created_at, cv.created_at) DESC, cv.id DESC`,
      [viewerId],
    );
    const peerIds = result.rows.map((row) => (row.user_low === viewerId ? row.user_high : row.user_low));
    const users = await loadPublicMap(this.pg, peerIds, viewerId);
    return result.rows.map((row) => {
      const peerId = row.user_low === viewerId ? row.user_high : row.user_low;
      return {
        id: row.id,
        peer: users.get(peerId)!,
        unread: Number(row.unread),
        lastMessage: row.last_id
          ? {
              id: row.last_id,
              senderId: row.last_sender_id!,
              text: row.last_text!,
              createdAt: toIso(row.last_created_at!),
            }
          : null,
      };
    });
  }

  async ensure(viewerId: string, peerId: string): Promise<ConversationItem> {
    if (viewerId === peerId) {
      throw new AppError(400, ErrorCode.FOLLOW_SELF, "不能和自己发私信");
    }
    await requireUser(this.pg, peerId);
    const { low, high } = pairUsers(viewerId, peerId);
    const existing = await this.pg.query<{ id: string }>(
      "SELECT id FROM conversations WHERE user_low = $1 AND user_high = $2",
      [low, high],
    );
    const id = existing.rows[0]?.id ?? newId("cv");
    if (!existing.rows[0]) {
      await this.pg.query("INSERT INTO conversations (id, user_low, user_high) VALUES ($1,$2,$3)", [id, low, high]);
      await this.pg.query(
        `INSERT INTO conversation_unreads (conversation_id, user_id, unread)
         VALUES ($1,$2,0), ($1,$3,0)`,
        [id, viewerId, peerId],
      );
    }
    const list = await this.list(viewerId);
    const found = list.find((item) => item.id === id);
    if (!found) {
      throw new AppError(404, ErrorCode.CONVERSATION_NOT_FOUND, "会话不存在");
    }
    return found;
  }

  async listMessages(
    viewerId: string,
    conversationId: string,
    query: { cursor?: string; limit: number },
  ): Promise<{ items: ChatMessageItem[]; nextCursor: string | null; hasMore: boolean }> {
    await this.requireMember(conversationId, viewerId);
    const cursor = decodeCursor(query.cursor);
    const params: unknown[] = [conversationId];
    let where = "WHERE conversation_id = $1";
    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      where += ` AND (created_at, id) > ($${params.length - 1}, $${params.length})`;
    }
    params.push(query.limit + 1);
    const result = await this.pg.query<{ id: string; sender_id: string; text: string; created_at: Date }>(
      `SELECT id, sender_id, text, created_at FROM messages ${where}
       ORDER BY created_at ASC, id ASC LIMIT $${params.length}`,
      params,
    );
    const items = result.rows.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      text: row.text,
      createdAt: toIso(row.created_at),
    }));
    return paginate(items, query.limit, (item) => ({ createdAt: item.createdAt, id: item.id }));
  }

  async send(viewerId: string, conversationId: string, textRaw?: string): Promise<ChatMessageItem> {
    await hitRateLimit(this.redis, `rl:msg:${viewerId}`, 60, 3600);
    const text = (textRaw ?? "").trim();
    if (!text) {
      throw new AppError(422, ErrorCode.EMPTY_CONTENT, "先写点什么再发布吧");
    }
    const conv = await this.requireMember(conversationId, viewerId);
    const peerId = conv.user_low === viewerId ? conv.user_high : conv.user_low;
    const inserted = await this.pg.query<{ id: string; sender_id: string; text: string; created_at: Date }>(
      `INSERT INTO messages (id, conversation_id, sender_id, text)
       VALUES ($1,$2,$3,$4)
       RETURNING id, sender_id, text, created_at`,
      [newId("m"), conversationId, viewerId, text],
    );
    await this.pg.query(
      `INSERT INTO conversation_unreads (conversation_id, user_id, unread)
       VALUES ($1,$2,0)
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET unread = 0`,
      [conversationId, viewerId],
    );
    await this.pg.query(
      `INSERT INTO conversation_unreads (conversation_id, user_id, unread)
       VALUES ($1,$2,1)
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET unread = conversation_unreads.unread + 1`,
      [conversationId, peerId],
    );
    const row = inserted.rows[0];
    return { id: row.id, senderId: row.sender_id, text: row.text, createdAt: toIso(row.created_at) };
  }

  async markRead(viewerId: string, conversationId: string): Promise<{ unread: number }> {
    await this.requireMember(conversationId, viewerId);
    await this.pg.query(
      `INSERT INTO conversation_unreads (conversation_id, user_id, unread)
       VALUES ($1,$2,0)
       ON CONFLICT (conversation_id, user_id) DO UPDATE SET unread = 0`,
      [conversationId, viewerId],
    );
    return { unread: 0 };
  }

  private async requireMember(conversationId: string, userId: string) {
    const result = await this.pg.query<{ id: string; user_low: string; user_high: string }>(
      "SELECT id, user_low, user_high FROM conversations WHERE id = $1",
      [conversationId],
    );
    const row = result.rows[0];
    if (!row || (row.user_low !== userId && row.user_high !== userId)) {
      throw new AppError(404, ErrorCode.CONVERSATION_NOT_FOUND, "会话不存在");
    }
    return row;
  }
}

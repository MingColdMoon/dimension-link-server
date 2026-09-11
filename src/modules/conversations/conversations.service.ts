import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { decodeCursor, paginate } from "../../common/cursor.js";
import { AppError, ErrorCode } from "../../common/errors.js";
import { toIso } from "../../common/http.js";
import { newId, pairUsers } from "../../common/ids.js";
import { hitRateLimit } from "../../middleware/rate-limit.js";
import type { ChatMessageItem, ConversationItem, UserPublic } from "../../types.js";
import { loadPublicMap, requireUser } from "../users/user.repo.js";

interface ConversationRow {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  owner_id: string | null;
  user_low: string | null;
  user_high: string | null;
  created_at: Date;
  unread: number;
  last_id: string | null;
  last_sender_id: string | null;
  last_text: string | null;
  last_created_at: Date | null;
}

function groupPeer(conversationId: string, title: string | null): UserPublic {
  return {
    id: conversationId,
    nickname: title?.trim() || "群聊",
    handle: "@group",
    bio: "",
    signature: "",
    emoji: "🪐",
    accentIndex: 6,
    followers: 0,
    following: 0,
    level: 1,
    badges: ["群聊"],
    isFollowing: false,
  };
}

export class ConversationService {
  constructor(
    private readonly pg: Pool,
    private readonly redis: Redis,
  ) {}

  async list(viewerId: string): Promise<ConversationItem[]> {
    const result = await this.pg.query<ConversationRow>(
      `SELECT
         cv.id, COALESCE(cv.kind, 'direct') AS kind, cv.title, cv.owner_id,
         cv.user_low, cv.user_high, cv.created_at,
         COALESCE(u.unread, 0) AS unread,
         m.id AS last_id, m.sender_id AS last_sender_id, m.text AS last_text, m.created_at AS last_created_at
       FROM conversations cv
       INNER JOIN conversation_members mem ON mem.conversation_id = cv.id AND mem.user_id = $1
       LEFT JOIN conversation_unreads u ON u.conversation_id = cv.id AND u.user_id = $1
       LEFT JOIN LATERAL (
         SELECT id, sender_id, text, created_at
         FROM messages
         WHERE conversation_id = cv.id
         ORDER BY created_at DESC, id DESC
         LIMIT 1
       ) m ON true
       ORDER BY COALESCE(m.created_at, cv.created_at) DESC, cv.id DESC`,
      [viewerId],
    );
    return this.toItems(viewerId, result.rows);
  }

  async ensure(viewerId: string, peerId: string): Promise<ConversationItem> {
    if (viewerId === peerId) {
      throw new AppError(400, ErrorCode.FOLLOW_SELF, "不能和自己发私信");
    }
    await requireUser(this.pg, peerId);
    const { low, high } = pairUsers(viewerId, peerId);
    const existing = await this.pg.query<{ id: string }>(
      "SELECT id FROM conversations WHERE kind = 'direct' AND user_low = $1 AND user_high = $2",
      [low, high],
    );
    const id = existing.rows[0]?.id ?? newId("cv");
    if (!existing.rows[0]) {
      await this.pg.query(
        `INSERT INTO conversations (id, user_low, user_high, kind, owner_id) VALUES ($1,$2,$3,'direct',$4)`,
        [id, low, high, viewerId],
      );
      await this.pg.query(
        `INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2), ($1,$3)`,
        [id, viewerId, peerId],
      );
      await this.pg.query(
        `INSERT INTO conversation_unreads (conversation_id, user_id, unread)
         VALUES ($1,$2,0), ($1,$3,0)`,
        [id, viewerId, peerId],
      );
    }
    return this.requireItem(viewerId, id);
  }

  async createGroup(viewerId: string, memberIdsRaw: string[], titleRaw?: string): Promise<ConversationItem> {
    const unique = [...new Set(memberIdsRaw.map((id) => id.trim()).filter((id) => id && id !== viewerId))];
    if (unique.length < 2) {
      throw new AppError(422, ErrorCode.GROUP_TOO_SMALL, "拉群至少再邀请两位住民");
    }
    const users = await loadPublicMap(this.pg, [viewerId, ...unique], viewerId);
    for (const id of unique) {
      if (!users.get(id)) {
        throw new AppError(404, ErrorCode.USER_NOT_FOUND, "住民不存在");
      }
    }
    const me = users.get(viewerId);
    const title = (titleRaw ?? "").trim() || [me?.nickname, ...unique.map((id) => users.get(id)?.nickname ?? "")]
      .filter(Boolean)
      .slice(0, 3)
      .join("、");
    const id = newId("cv");
    const memberIds = [viewerId, ...unique];
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO conversations (id, kind, title, owner_id) VALUES ($1,'group',$2,$3)`,
        [id, title, viewerId],
      );
      for (const memberId of memberIds) {
        await client.query(`INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2)`, [id, memberId]);
        await client.query(
          `INSERT INTO conversation_unreads (conversation_id, user_id, unread) VALUES ($1,$2,0)`,
          [id, memberId],
        );
      }
      for (const memberId of unique) {
        await client.query(
          `INSERT INTO notices (id, user_id, title, body, kind) VALUES ($1,$2,$3,$4,'group')`,
          [newId("n"), memberId, `${me?.nickname ?? "有人"} 拉你进了群`, `「${title}」等你一起聊天。`],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return this.requireItem(viewerId, id);
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
    await this.requireMember(conversationId, viewerId);
    const members = await this.memberIds(conversationId);
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
    for (const memberId of members) {
      if (memberId === viewerId) {
        continue;
      }
      await this.pg.query(
        `INSERT INTO conversation_unreads (conversation_id, user_id, unread)
         VALUES ($1,$2,1)
         ON CONFLICT (conversation_id, user_id) DO UPDATE SET unread = conversation_unreads.unread + 1`,
        [conversationId, memberId],
      );
    }
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
    const result = await this.pg.query<{ conversation_id: string }>(
      "SELECT conversation_id FROM conversation_members WHERE conversation_id = $1 AND user_id = $2",
      [conversationId, userId],
    );
    if (!result.rows[0]) {
      throw new AppError(404, ErrorCode.CONVERSATION_NOT_FOUND, "会话不存在");
    }
  }

  private async memberIds(conversationId: string): Promise<string[]> {
    const result = await this.pg.query<{ user_id: string }>(
      "SELECT user_id FROM conversation_members WHERE conversation_id = $1",
      [conversationId],
    );
    return result.rows.map((row) => row.user_id);
  }

  private async requireItem(viewerId: string, id: string): Promise<ConversationItem> {
    const list = await this.list(viewerId);
    const found = list.find((item) => item.id === id);
    if (!found) {
      throw new AppError(404, ErrorCode.CONVERSATION_NOT_FOUND, "会话不存在");
    }
    return found;
  }

  private async toItems(viewerId: string, rows: ConversationRow[]): Promise<ConversationItem[]> {
    if (rows.length === 0) {
      return [];
    }
    const memberRows = await this.pg.query<{ conversation_id: string; user_id: string }>(
      `SELECT conversation_id, user_id FROM conversation_members
       WHERE conversation_id = ANY($1::text[])`,
      [rows.map((row) => row.id)],
    );
    const membersByConv = new Map<string, string[]>();
    for (const row of memberRows.rows) {
      const list = membersByConv.get(row.conversation_id) ?? [];
      list.push(row.user_id);
      membersByConv.set(row.conversation_id, list);
    }
    const allUserIds = [...new Set(memberRows.rows.map((row) => row.user_id))];
    const users = await loadPublicMap(this.pg, allUserIds, viewerId);
    return rows.map((row) => {
      const memberIds = membersByConv.get(row.id) ?? [];
      const members = memberIds.map((id) => users.get(id)).filter((item): item is UserPublic => Boolean(item));
      const lastMessage = row.last_id
        ? {
            id: row.last_id,
            senderId: row.last_sender_id!,
            text: row.last_text!,
            createdAt: toIso(row.last_created_at!),
          }
        : null;
      if (row.kind === "group") {
        return {
          id: row.id,
          kind: "group",
          title: row.title,
          ownerId: row.owner_id,
          members,
          peer: groupPeer(row.id, row.title),
          unread: Number(row.unread),
          lastMessage,
        };
      }
      const peerId = row.user_low === viewerId ? row.user_high : row.user_low;
      const peer = (peerId ? users.get(peerId) : undefined) ?? members.find((item) => item.id !== viewerId);
      if (!peer) {
        throw new AppError(404, ErrorCode.CONVERSATION_NOT_FOUND, "会话不存在");
      }
      return {
        id: row.id,
        kind: "direct",
        title: null,
        ownerId: row.owner_id,
        members,
        peer,
        unread: Number(row.unread),
        lastMessage,
      };
    });
  }
}

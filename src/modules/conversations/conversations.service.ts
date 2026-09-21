import type { Pool, PoolClient } from "pg";
import type { Redis } from "ioredis";
import { decodeCursor, paginate } from "../../common/cursor.js";
import { AppError, ErrorCode } from "../../common/errors.js";
import { toIso } from "../../common/http.js";
import { newId, pairUsers } from "../../common/ids.js";
import { isIllustrationUrl, saveChatImage } from "../../common/uploads.js";
import { hitRateLimit } from "../../middleware/rate-limit.js";
import type { ChatMessageItem, ConversationItem, MessageKind, UserPublic } from "../../types.js";
import { loadPublicMap, requireUser } from "../users/user.repo.js";
import {
  canKick,
  canMute,
  canSetAdmin,
  canSpeak,
  canToggleGroupMute,
  nextOwner,
  resolveRole,
  type GroupRole,
} from "./group.rules.js";

interface ConversationRow {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  owner_id: string | null;
  muted: boolean;
  user_low: string | null;
  user_high: string | null;
  created_at: Date;
  unread: number;
  last_id: string | null;
  last_sender_id: string | null;
  last_text: string | null;
  last_kind: MessageKind | null;
  last_image_url: string | null;
  last_created_at: Date | null;
}

interface MemberRow {
  conversation_id: string;
  user_id: string;
  role: GroupRole;
  muted: boolean;
}

export interface SendMessageInput {
  text?: string;
  kind?: "text" | "image";
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
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

function toMessage(row: {
  id: string;
  sender_id: string | null;
  text: string;
  created_at: Date;
  kind?: string | null;
  image_url?: string | null;
}): ChatMessageItem {
  const kind = row.kind === "image" || row.kind === "system" ? row.kind : "text";
  return {
    id: row.id,
    senderId: row.sender_id ?? "system",
    text: row.text,
    createdAt: toIso(row.created_at),
    kind: !row.sender_id ? "system" : kind,
    imageUrl: row.image_url ?? null,
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
         COALESCE(cv.muted, false) AS muted,
         cv.user_low, cv.user_high, cv.created_at,
         COALESCE(u.unread, 0) AS unread,
         m.id AS last_id, m.sender_id AS last_sender_id, m.text AS last_text,
         m.kind AS last_kind, m.image_url AS last_image_url, m.created_at AS last_created_at
       FROM conversations cv
       INNER JOIN conversation_members mem ON mem.conversation_id = cv.id AND mem.user_id = $1
       LEFT JOIN conversation_unreads u ON u.conversation_id = cv.id AND u.user_id = $1
       LEFT JOIN LATERAL (
         SELECT id, sender_id, text, kind, image_url, created_at
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

  async get(viewerId: string, conversationId: string): Promise<ConversationItem> {
    return this.requireItem(viewerId, conversationId);
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
        `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1,$2,'member'), ($1,$3,'member')`,
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
        await client.query(
          `INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1,$2,$3)`,
          [id, memberId, memberId === viewerId ? "owner" : "member"],
        );
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
      await this.insertSystem(client, id, `${me?.nickname ?? "有人"} 创建了群聊`);
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
    const result = await this.pg.query<{
      id: string;
      sender_id: string | null;
      text: string;
      created_at: Date;
      kind: string;
      image_url: string | null;
    }>(
      `SELECT id, sender_id, text, created_at, kind, image_url FROM messages ${where}
       ORDER BY created_at ASC, id ASC LIMIT $${params.length}`,
      params,
    );
    const items = result.rows.map((row) => toMessage(row));
    return paginate(items, query.limit, (item) => ({ createdAt: item.createdAt, id: item.id }));
  }

  async send(viewerId: string, conversationId: string, input: SendMessageInput): Promise<ChatMessageItem> {
    await hitRateLimit(this.redis, `rl:msg:${viewerId}`, 60, 3600);
    const conversation = await this.requireItem(viewerId, conversationId);
    if (conversation.kind === "group") {
      const role = resolveRole(conversation.ownerId, conversation.adminIds, viewerId);
      const memberMuted = conversation.mutedUserIds.includes(viewerId);
      if (!canSpeak(role, conversation.groupMuted, memberMuted)) {
        throw new AppError(403, ErrorCode.GROUP_MUTED, conversation.groupMuted ? "群主开启了全员禁言" : "你已被禁言");
      }
    }

    const kind = input.kind === "image" ? "image" : "text";
    let imageUrl: string | null = null;
    let text = (input.text ?? "").trim();
    if (kind === "image") {
      if (input.imageBase64) {
        imageUrl = await saveChatImage(input.imageBase64, input.mimeType ?? "image/jpeg");
      } else if (input.imageUrl && isIllustrationUrl(input.imageUrl)) {
        imageUrl = input.imageUrl;
      } else {
        throw new AppError(422, ErrorCode.INVALID_IMAGE, "先选一张图片再发送吧");
      }
      if (!text) {
        text = "[图片]";
      }
    } else if (!text) {
      throw new AppError(422, ErrorCode.EMPTY_CONTENT, "先写点什么再发布吧");
    }

    const members = conversation.members.map((item) => item.id);
    const inserted = await this.pg.query<{
      id: string;
      sender_id: string;
      text: string;
      created_at: Date;
      kind: string;
      image_url: string | null;
    }>(
      `INSERT INTO messages (id, conversation_id, sender_id, text, kind, image_url)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, sender_id, text, created_at, kind, image_url`,
      [newId("m"), conversationId, viewerId, text, kind, imageUrl],
    );
    await this.bumpUnread(conversationId, viewerId, members);
    return toMessage(inserted.rows[0]);
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

  async setAdmin(viewerId: string, conversationId: string, targetId: string, admin: boolean): Promise<ConversationItem> {
    const conversation = await this.requireGroup(viewerId, conversationId);
    const actor = resolveRole(conversation.ownerId, conversation.adminIds, viewerId);
    if (!canSetAdmin(actor)) {
      throw new AppError(403, ErrorCode.GROUP_FORBIDDEN, "只有群主能设置管理员");
    }
    if (targetId === conversation.ownerId) {
      throw new AppError(403, ErrorCode.GROUP_FORBIDDEN, "群主不用再设成管理员");
    }
    if (!conversation.members.some((item) => item.id === targetId)) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND, "这位住民不在群里");
    }
    await this.pg.query(
      `UPDATE conversation_members SET role = $3 WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, targetId, admin ? "admin" : "member"],
    );
    const name = conversation.members.find((item) => item.id === targetId)?.nickname ?? "有人";
    await this.insertSystem(this.pg, conversationId, admin ? `${name} 被设为管理员` : `${name} 不再是管理员`);
    return this.requireItem(viewerId, conversationId);
  }

  async setMute(
    viewerId: string,
    conversationId: string,
    input: { userId?: string; muted: boolean },
  ): Promise<ConversationItem> {
    const conversation = await this.requireGroup(viewerId, conversationId);
    const actor = resolveRole(conversation.ownerId, conversation.adminIds, viewerId);
    if (!input.userId) {
      if (!canToggleGroupMute(actor)) {
        throw new AppError(403, ErrorCode.GROUP_FORBIDDEN, "只有群主或管理员能全员禁言");
      }
      await this.pg.query("UPDATE conversations SET muted = $2 WHERE id = $1", [conversationId, input.muted]);
      await this.insertSystem(this.pg, conversationId, input.muted ? "开启了全员禁言" : "关闭了全员禁言");
      return this.requireItem(viewerId, conversationId);
    }
    const target = resolveRole(conversation.ownerId, conversation.adminIds, input.userId);
    if (!canMute(actor, target)) {
      throw new AppError(403, ErrorCode.GROUP_FORBIDDEN, "没有权限禁言这位住民");
    }
    if (!conversation.members.some((item) => item.id === input.userId)) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND, "这位住民不在群里");
    }
    await this.pg.query(
      `UPDATE conversation_members SET muted = $3 WHERE conversation_id = $1 AND user_id = $2`,
      [conversationId, input.userId, input.muted],
    );
    const name = conversation.members.find((item) => item.id === input.userId)?.nickname ?? "有人";
    await this.insertSystem(this.pg, conversationId, input.muted ? `${name} 被禁言` : `${name} 已解除禁言`);
    return this.requireItem(viewerId, conversationId);
  }

  async kick(viewerId: string, conversationId: string, targetId: string): Promise<ConversationItem> {
    const conversation = await this.requireGroup(viewerId, conversationId);
    const actor = resolveRole(conversation.ownerId, conversation.adminIds, viewerId);
    const target = resolveRole(conversation.ownerId, conversation.adminIds, targetId);
    if (!canKick(actor, target)) {
      throw new AppError(403, ErrorCode.GROUP_FORBIDDEN, "没有权限移出这位住民");
    }
    if (!conversation.members.some((item) => item.id === targetId)) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND, "这位住民不在群里");
    }
    await this.removeMember(conversationId, targetId);
    const name = conversation.members.find((item) => item.id === targetId)?.nickname ?? "有人";
    await this.insertSystem(this.pg, conversationId, `${name} 被移出了群聊`);
    await this.pg.query(
      `INSERT INTO notices (id, user_id, title, body, kind) VALUES ($1,$2,$3,$4,'group')`,
      [newId("n"), targetId, `你被移出了 ${conversation.title ?? "群聊"}`, "群主或管理员把你请出了这个次元。"],
    );
    return this.requireItem(viewerId, conversationId);
  }

  async leave(viewerId: string, conversationId: string): Promise<{ left: true }> {
    const conversation = await this.requireGroup(viewerId, conversationId);
    const memberIds = conversation.members.map((item) => item.id);
    const name = conversation.members.find((item) => item.id === viewerId)?.nickname ?? "有人";
    if (conversation.ownerId === viewerId) {
      const successor = nextOwner(viewerId, conversation.adminIds, memberIds);
      if (successor) {
        await this.pg.query("UPDATE conversations SET owner_id = $2 WHERE id = $1", [conversationId, successor]);
        await this.pg.query(
          `UPDATE conversation_members SET role = 'owner', muted = false WHERE conversation_id = $1 AND user_id = $2`,
          [conversationId, successor],
        );
        const successorName = conversation.members.find((item) => item.id === successor)?.nickname ?? "下一位";
        await this.removeMember(conversationId, viewerId);
        await this.insertSystem(this.pg, conversationId, `${name} 把群主交给了 ${successorName} 并离开了`);
        return { left: true };
      }
      await this.dissolve(conversationId);
      return { left: true };
    }
    await this.removeMember(conversationId, viewerId);
    await this.insertSystem(this.pg, conversationId, `${name} 离开了群聊`);
    return { left: true };
  }

  private async dissolve(conversationId: string): Promise<void> {
    await this.pg.query("DELETE FROM conversations WHERE id = $1", [conversationId]);
  }

  private async removeMember(conversationId: string, userId: string): Promise<void> {
    await this.pg.query("DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2", [
      conversationId,
      userId,
    ]);
    await this.pg.query("DELETE FROM conversation_unreads WHERE conversation_id = $1 AND user_id = $2", [
      conversationId,
      userId,
    ]);
  }

  private async bumpUnread(conversationId: string, viewerId: string, members: string[]): Promise<void> {
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
  }

  private async insertSystem(db: Pool | PoolClient, conversationId: string, text: string): Promise<void> {
    await db.query(
      `INSERT INTO messages (id, conversation_id, sender_id, text, kind)
       VALUES ($1,$2,NULL,$3,'system')`,
      [newId("m"), conversationId, text],
    );
  }

  private async requireGroup(viewerId: string, conversationId: string): Promise<ConversationItem> {
    const conversation = await this.requireItem(viewerId, conversationId);
    if (conversation.kind !== "group") {
      throw new AppError(422, ErrorCode.NOT_GROUP, "这不是群聊");
    }
    return conversation;
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
    const memberRows = await this.pg.query<MemberRow>(
      `SELECT conversation_id, user_id, COALESCE(role, 'member') AS role, COALESCE(muted, false) AS muted
       FROM conversation_members
       WHERE conversation_id = ANY($1::text[])`,
      [rows.map((row) => row.id)],
    );
    const membersByConv = new Map<string, MemberRow[]>();
    for (const row of memberRows.rows) {
      const list = membersByConv.get(row.conversation_id) ?? [];
      list.push(row);
      membersByConv.set(row.conversation_id, list);
    }
    const allUserIds = [...new Set(memberRows.rows.map((row) => row.user_id))];
    const users = await loadPublicMap(this.pg, allUserIds, viewerId);
    return rows.map((row) => {
      const memberMeta = membersByConv.get(row.id) ?? [];
      const members = memberMeta
        .map((item) => users.get(item.user_id))
        .filter((item): item is UserPublic => Boolean(item));
      const adminIds = memberMeta.filter((item) => item.role === "admin").map((item) => item.user_id);
      const mutedUserIds = memberMeta.filter((item) => item.muted).map((item) => item.user_id);
      const lastMessage = row.last_id
        ? toMessage({
            id: row.last_id,
            sender_id: row.last_sender_id,
            text: row.last_text!,
            created_at: row.last_created_at!,
            kind: row.last_kind,
            image_url: row.last_image_url,
          })
        : null;
      if (row.kind === "group") {
        return {
          id: row.id,
          kind: "group",
          title: row.title,
          ownerId: row.owner_id,
          adminIds,
          mutedUserIds,
          groupMuted: Boolean(row.muted),
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
        adminIds: [],
        mutedUserIds: [],
        groupMuted: false,
        members,
        peer,
        unread: Number(row.unread),
        lastMessage,
      };
    });
  }
}

import type { Pool } from "pg";
import { decodeCursor, paginate } from "../../common/cursor.js";
import { AppError, ErrorCode } from "../../common/errors.js";
import { toIso } from "../../common/http.js";
import { newId } from "../../common/ids.js";
import { hitRateLimit } from "../../middleware/rate-limit.js";
import type { Redis } from "ioredis";
import type { CommentItem, PostCard } from "../../types.js";
import { toCircleSummary, toPostCard } from "../users/user.mapper.js";
import { loadPublicMap, requireUser } from "../users/user.repo.js";
import { MOODS } from "../users/user.types.js";

interface PostQueryRow {
  id: string;
  author_id: string;
  content: string;
  created_at: Date;
  mood: string;
  circle_id: string;
  circle_name: string;
  circle_emoji: string;
  image_hue: number;
  image_title: string;
  like_count: number;
  star_count: number;
  comment_count: number;
  liked: boolean;
  starred: boolean;
}

const POST_SELECT = `
  SELECT
    p.id, p.author_id, p.content, p.created_at, p.mood, p.circle_id,
    c.name AS circle_name, c.emoji AS circle_emoji,
    p.image_hue, p.image_title,
    (SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
    (SELECT COUNT(*)::int FROM post_stars ps WHERE ps.post_id = p.id) AS star_count,
    (SELECT COUNT(*)::int FROM comments cm WHERE cm.post_id = p.id) AS comment_count,
    EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS liked,
    EXISTS (SELECT 1 FROM post_stars ps WHERE ps.post_id = p.id AND ps.user_id = $1) AS starred
  FROM posts p
  JOIN circles c ON c.id = p.circle_id
`;

export class PostService {
  constructor(
    private readonly pg: Pool,
    private readonly redis: Redis,
  ) {}

  async list(
    viewerId: string,
    query: { cursor?: string; limit: number; authorId?: string; circleId?: string },
  ): Promise<{ items: PostCard[]; nextCursor: string | null; hasMore: boolean }> {
    const cursor = decodeCursor(query.cursor);
    const params: unknown[] = [viewerId];
    const filters: string[] = [];
    if (query.authorId) {
      params.push(query.authorId);
      filters.push(`p.author_id = $${params.length}`);
    }
    if (query.circleId) {
      params.push(query.circleId);
      filters.push(`p.circle_id = $${params.length}`);
    }
    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      filters.push(`(p.created_at, p.id) < ($${params.length - 1}, $${params.length})`);
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    params.push(query.limit + 1);
    const result = await this.pg.query<PostQueryRow>(
      `${POST_SELECT} ${where} ORDER BY p.created_at DESC, p.id DESC LIMIT $${params.length}`,
      params,
    );
    const cards = await this.toCards(viewerId, result.rows);
    return paginate(cards, query.limit, (item) => ({ createdAt: item.createdAt, id: item.id }));
  }

  async get(viewerId: string, postId: string): Promise<PostCard> {
    const result = await this.pg.query<PostQueryRow>(`${POST_SELECT} WHERE p.id = $2`, [viewerId, postId]);
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCode.POST_NOT_FOUND, "动态不存在");
    }
    const [card] = await this.toCards(viewerId, [row]);
    const comments = await this.listComments(viewerId, postId, { limit: 20 });
    return { ...card, comments: comments.items };
  }

  async create(
    viewerId: string,
    input: { content?: string; circleId?: string; mood?: string; imageTitle?: string; imageHue?: number },
  ): Promise<PostCard> {
    await hitRateLimit(this.redis, `rl:post:${viewerId}`, 30, 3600);
    const content = (input.content ?? "").trim();
    if (!content) {
      throw new AppError(422, ErrorCode.EMPTY_CONTENT, "先写点什么再发布吧");
    }
    const circleId = input.circleId ?? "";
    const circle = await this.pg.query("SELECT id FROM circles WHERE id = $1", [circleId]);
    if (!circle.rows[0]) {
      throw new AppError(404, ErrorCode.CIRCLE_NOT_FOUND, "圈子不存在");
    }
    const mood = input.mood ?? "happy";
    if (!MOODS.includes(mood as (typeof MOODS)[number])) {
      throw new AppError(422, ErrorCode.INVALID_MOOD, "心情签不合法");
    }
    const imageTitle = (input.imageTitle ?? "").trim() || "今日速记";
    const imageHue =
      typeof input.imageHue === "number" && input.imageHue >= 0 && input.imageHue <= 359
        ? Math.floor(input.imageHue)
        : Math.floor(Math.random() * 360);
    const id = newId("p");
    await this.pg.query(
      `INSERT INTO posts (id, author_id, content, mood, circle_id, image_hue, image_title)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, viewerId, content, mood, circleId, imageHue, imageTitle],
    );
    return this.get(viewerId, id);
  }

  async toggleLike(viewerId: string, postId: string): Promise<{ liked: boolean; likeCount: number }> {
    const post = await this.requirePost(postId);
    const existing = await this.pg.query("SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2", [
      postId,
      viewerId,
    ]);
    if (existing.rows[0]) {
      await this.pg.query("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", [postId, viewerId]);
    } else {
      await this.pg.query("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)", [postId, viewerId]);
      if (post.author_id !== viewerId) {
        const me = await requireUser(this.pg, viewerId);
        await this.pg.query(
          `INSERT INTO notices (id, user_id, title, body, kind) VALUES ($1,$2,$3,$4,'like')`,
          [newId("n"), post.author_id, `${me.nickname} 喜欢了你的动态`, `「${post.image_title}」收到了一枚喜欢。`],
        );
      }
    }
    const liked = !(existing.rows[0]);
    const count = await this.pg.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = $1",
      [postId],
    );
    return { liked, likeCount: count.rows[0].count };
  }

  async toggleStar(viewerId: string, postId: string): Promise<{ starred: boolean; starCount: number }> {
    const post = await this.requirePost(postId);
    const existing = await this.pg.query("SELECT 1 FROM post_stars WHERE post_id = $1 AND user_id = $2", [
      postId,
      viewerId,
    ]);
    if (existing.rows[0]) {
      await this.pg.query("DELETE FROM post_stars WHERE post_id = $1 AND user_id = $2", [postId, viewerId]);
    } else {
      await this.pg.query("INSERT INTO post_stars (post_id, user_id) VALUES ($1, $2)", [postId, viewerId]);
      if (post.author_id !== viewerId) {
        const me = await requireUser(this.pg, viewerId);
        await this.pg.query(
          `INSERT INTO notices (id, user_id, title, body, kind) VALUES ($1,$2,$3,$4,'star')`,
          [newId("n"), post.author_id, `${me.nickname} 收藏了你的动态`, `「${post.image_title}」被收入对方的星标匣。`],
        );
      }
    }
    const starred = !(existing.rows[0]);
    const count = await this.pg.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM post_stars WHERE post_id = $1",
      [postId],
    );
    return { starred, starCount: count.rows[0].count };
  }

  async listComments(
    viewerId: string,
    postId: string,
    query: { cursor?: string; limit: number },
  ): Promise<{ items: CommentItem[]; nextCursor: string | null; hasMore: boolean }> {
    await this.requirePost(postId);
    const cursor = decodeCursor(query.cursor);
    const params: unknown[] = [postId];
    let where = "WHERE post_id = $1";
    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      where += ` AND (created_at, id) > ($${params.length - 1}, $${params.length})`;
    }
    params.push(query.limit + 1);
    const result = await this.pg.query<{ id: string; user_id: string; content: string; created_at: Date }>(
      `SELECT id, user_id, content, created_at FROM comments ${where}
       ORDER BY created_at ASC, id ASC LIMIT $${params.length}`,
      params,
    );
    const users = await loadPublicMap(
      this.pg,
      result.rows.map((row) => row.user_id),
      viewerId,
    );
    const items = result.rows.map((row) => ({
      id: row.id,
      user: users.get(row.user_id)!,
      content: row.content,
      createdAt: toIso(row.created_at),
    }));
    return paginate(items, query.limit, (item) => ({ createdAt: item.createdAt, id: item.id }));
  }

  async addComment(viewerId: string, postId: string, contentRaw?: string): Promise<CommentItem> {
    const content = (contentRaw ?? "").trim();
    if (!content) {
      throw new AppError(422, ErrorCode.EMPTY_CONTENT, "先写点什么再发布吧");
    }
    const post = await this.requirePost(postId);
    const id = newId("cmt");
    const inserted = await this.pg.query<{ id: string; user_id: string; content: string; created_at: Date }>(
      `INSERT INTO comments (id, post_id, user_id, content)
       VALUES ($1,$2,$3,$4)
       RETURNING id, user_id, content, created_at`,
      [id, postId, viewerId, content],
    );
    if (post.author_id !== viewerId) {
      const me = await requireUser(this.pg, viewerId);
      await this.pg.query(`INSERT INTO notices (id, user_id, title, body, kind) VALUES ($1,$2,$3,$4,'comment')`, [
        newId("n"),
        post.author_id,
        `${me.nickname} 评论了你的动态`,
        content.slice(0, 80),
      ]);
    }
    const users = await loadPublicMap(this.pg, [viewerId], viewerId);
    const row = inserted.rows[0];
    return {
      id: row.id,
      user: users.get(viewerId)!,
      content: row.content,
      createdAt: toIso(row.created_at),
    };
  }

  private async requirePost(postId: string): Promise<{ id: string; author_id: string; image_title: string }> {
    const result = await this.pg.query<{ id: string; author_id: string; image_title: string }>(
      "SELECT id, author_id, image_title FROM posts WHERE id = $1",
      [postId],
    );
    if (!result.rows[0]) {
      throw new AppError(404, ErrorCode.POST_NOT_FOUND, "动态不存在");
    }
    return result.rows[0];
  }

  private async toCards(viewerId: string, rows: PostQueryRow[]): Promise<PostCard[]> {
    const users = await loadPublicMap(
      this.pg,
      rows.map((row) => row.author_id),
      viewerId,
    );
    return rows.map((row) =>
      toPostCard({
        ...row,
        author: users.get(row.author_id)!,
        circle: toCircleSummary({ id: row.circle_id, name: row.circle_name, emoji: row.circle_emoji }),
      }),
    );
  }
}

import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { likePattern } from "../../common/pg.js";
import type { CircleItem, PostCard, UserPublic } from "../../types.js";
import { CircleService } from "../circles/circles.service.js";
import { PostService } from "../posts/posts.service.js";
import { toCircleItem, toUserPublic } from "../users/user.mapper.js";
import { isFollowing } from "../users/user.repo.js";
import { USER_PUBLIC_COLUMNS, type UserRow } from "../users/user.types.js";

export class SearchService {
  private readonly circles: CircleService;
  private readonly posts: PostService;

  constructor(pg: Pool, redis: Redis) {
    this.circles = new CircleService(pg);
    this.posts = new PostService(pg, redis);
    this.pg = pg;
  }

  private readonly pg: Pool;

  async search(
    viewerId: string,
    qRaw: string,
    limit: number,
  ): Promise<{ users: UserPublic[]; circles: CircleItem[]; posts: PostCard[] }> {
    const q = qRaw.trim();
    if (!q) {
      const users = await this.searchUsers(viewerId, "", limit);
      const circles = await this.circles.list(viewerId);
      const posts = await this.posts.list(viewerId, { limit });
      return { users, circles, posts: posts.items };
    }

    const pattern = likePattern(q);
    return {
      users: await this.searchUsers(viewerId, pattern, limit),
      circles: await this.searchCircles(viewerId, pattern, limit),
      posts: await this.searchPosts(viewerId, q, limit),
    };
  }

  private async searchUsers(viewerId: string, pattern: string, limit: number): Promise<UserPublic[]> {
    const result = await this.pg.query<UserRow>(
      pattern
        ? `SELECT ${USER_PUBLIC_COLUMNS} FROM users
           WHERE nickname ILIKE $1 ESCAPE '\\' OR handle ILIKE $1 ESCAPE '\\' OR bio ILIKE $1 ESCAPE '\\'
           LIMIT $2`
        : `SELECT ${USER_PUBLIC_COLUMNS} FROM users ORDER BY created_at DESC LIMIT $1`,
      pattern ? [pattern, limit] : [limit],
    );
    const items: UserPublic[] = [];
    for (const row of result.rows) {
      items.push(toUserPublic(row, row.id === viewerId ? false : await isFollowing(this.pg, viewerId, row.id)));
    }
    return items;
  }

  private async searchCircles(viewerId: string, pattern: string, limit: number): Promise<CircleItem[]> {
    const result = await this.pg.query<{
      id: string;
      name: string;
      emoji: string;
      description: string;
      member_count: number;
      accent_index: number;
      tags: string[];
      joined: boolean;
    }>(
      `SELECT c.*, EXISTS (
         SELECT 1 FROM circle_members m WHERE m.circle_id = c.id AND m.user_id = $2
       ) AS joined
       FROM circles c
       WHERE c.name ILIKE $1 ESCAPE '\\' OR c.description ILIKE $1 ESCAPE '\\'
       ORDER BY c.id
       LIMIT $3`,
      [pattern, viewerId, limit],
    );
    return result.rows.map((row) => toCircleItem(row));
  }

  private async searchPosts(viewerId: string, q: string, limit: number): Promise<PostCard[]> {
    const result = await this.pg.query<{ id: string }>(
      `SELECT p.id
       FROM posts p
       JOIN users u ON u.id = p.author_id
       JOIN circles c ON c.id = p.circle_id
       WHERE p.content ILIKE $1 ESCAPE '\\'
          OR u.nickname ILIKE $1 ESCAPE '\\'
          OR c.name ILIKE $1 ESCAPE '\\'
       ORDER BY p.created_at DESC
       LIMIT $2`,
      [likePattern(q), limit],
    );
    const items: PostCard[] = [];
    for (const row of result.rows) {
      const card = await this.posts.get(viewerId, row.id);
      delete card.comments;
      items.push(card);
    }
    return items;
  }
}

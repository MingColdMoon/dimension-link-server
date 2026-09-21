import type { Pool } from "pg";
import { AppError, ErrorCode } from "../../common/errors.js";
import { newId } from "../../common/ids.js";
import { isFollowing, loadPublicMap, requireUser } from "../users/user.repo.js";
import { UserService } from "../users/users.service.js";
import { parseMatchMode, recommend } from "./match.engine.js";
import type { MatchCandidateView, MatchScoreInput } from "./match.types.js";

interface UserMatchRow {
  id: string;
  nickname: string;
  bio: string;
  signature: string;
  badges: string[];
  hobbies: string[];
  city: string;
  district: string;
  latitude: string | number | null;
  longitude: string | number | null;
  level: number;
  last_seen_at: Date | null;
  circle_hints: string[];
}

export class MatchService {
  private readonly users: UserService;

  constructor(private readonly pg: Pool) {
    this.users = new UserService(pg);
  }

  async recommend(viewerId: string, modeRaw: string | undefined, limit: number): Promise<MatchCandidateView[]> {
    const mode = parseMatchMode(modeRaw);
    const [me, others, posted] = await Promise.all([
      this.loadScoreInput(viewerId, viewerId, false),
      this.loadCandidates(viewerId),
      this.loadPostedCircles(),
    ]);
    if (!me) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND, "住民不存在");
    }
    me.postedCircleIds = posted.get(viewerId) ?? [];
    for (const item of others) {
      item.postedCircleIds = posted.get(item.id) ?? [];
    }

    const ranked = recommend(me, others, mode).slice(0, limit);
    const publicMap = await loadPublicMap(
      this.pg,
      ranked.map((item) => item.userId),
      viewerId,
    );
    return ranked.flatMap((item) => {
      const user = publicMap.get(item.userId);
      if (!user) {
        return [];
      }
      const { userId: _userId, ...rest } = item;
      return [{ ...rest, user }];
    });
  }

  async like(viewerId: string, targetId: string): Promise<{ liked: true }> {
    if (viewerId === targetId) {
      throw new AppError(400, ErrorCode.FOLLOW_SELF, "不能关注自己");
    }
    await requireUser(this.pg, targetId);
    const inserted = await this.pg.query(
      "INSERT INTO match_likes (viewer_id, target_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING target_id",
      [viewerId, targetId],
    );
    if (!inserted.rows[0]) {
      return { liked: true };
    }
    if (!(await isFollowing(this.pg, viewerId, targetId))) {
      await this.users.toggleFollow(viewerId, targetId);
    }
    const me = await this.pg.query<{ nickname: string }>("SELECT nickname FROM users WHERE id = $1", [viewerId]);
    await this.pg.query(
      `INSERT INTO notices (id, user_id, title, body, kind)
       VALUES ($1, $2, $3, $4, 'like')`,
      [
        newId("n"),
        targetId,
        `${me.rows[0]?.nickname ?? "有人"} 对你心动了`,
        "次元信号对上了，去私信里看看吧。",
      ],
    );
    return { liked: true };
  }

  private async loadScoreInput(
    viewerId: string,
    userId: string,
    following: boolean,
  ): Promise<MatchScoreInput | undefined> {
    const result = await this.pg.query<UserMatchRow>(
      `SELECT u.id, u.nickname, u.bio, u.signature, u.badges, u.hobbies, u.city, u.district,
              u.latitude, u.longitude, u.level, u.last_seen_at,
              COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '{}') AS circle_hints
       FROM users u
       LEFT JOIN circle_members m ON m.user_id = u.id
       LEFT JOIN circles c ON c.id = m.circle_id
       WHERE u.id = $1
       GROUP BY u.id`,
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return toScoreInput(row, following);
  }

  private async loadCandidates(viewerId: string): Promise<MatchScoreInput[]> {
    const result = await this.pg.query<UserMatchRow & { is_following: boolean }>(
      `SELECT u.id, u.nickname, u.bio, u.signature, u.badges, u.hobbies, u.city, u.district,
              u.latitude, u.longitude, u.level, u.last_seen_at,
              EXISTS (
                SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followee_id = u.id
              ) AS is_following,
              COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.name IS NOT NULL), '{}') AS circle_hints
       FROM users u
       LEFT JOIN circle_members m ON m.user_id = u.id
       LEFT JOIN circles c ON c.id = m.circle_id
       WHERE u.id <> $1
         AND NOT EXISTS (
           SELECT 1 FROM match_likes l WHERE l.viewer_id = $1 AND l.target_id = u.id
         )
       GROUP BY u.id`,
      [viewerId],
    );
    return result.rows.map((row) => toScoreInput(row, row.is_following));
  }

  private async loadPostedCircles(): Promise<Map<string, string[]>> {
    const result = await this.pg.query<{ author_id: string; circle_ids: string[] }>(
      `SELECT author_id, array_agg(DISTINCT circle_id) AS circle_ids
       FROM posts
       GROUP BY author_id`,
    );
    return new Map(result.rows.map((row) => [row.author_id, row.circle_ids ?? []]));
  }
}

function toScoreInput(row: UserMatchRow, isFollowing: boolean): MatchScoreInput {
  return {
    id: row.id,
    nickname: row.nickname,
    bio: row.bio,
    signature: row.signature,
    badges: row.badges ?? [],
    hobbies: row.hobbies ?? [],
    city: row.city ?? "",
    district: row.district ?? "",
    latitude: toNum(row.latitude),
    longitude: toNum(row.longitude),
    level: row.level,
    isFollowing,
    lastSeenAt: row.last_seen_at,
    circleHints: row.circle_hints ?? [],
    postedCircleIds: [],
  };
}

function toNum(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") {
    return null;
  }
  const value = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(value) ? value : null;
}

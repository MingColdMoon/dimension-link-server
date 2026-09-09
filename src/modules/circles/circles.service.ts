import type { Pool } from "pg";
import { AppError, ErrorCode } from "../../common/errors.js";
import type { CircleItem } from "../../types.js";
import { toCircleItem } from "../users/user.mapper.js";

export class CircleService {
  constructor(private readonly pg: Pool) {}

  async list(viewerId: string): Promise<CircleItem[]> {
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
         SELECT 1 FROM circle_members m WHERE m.circle_id = c.id AND m.user_id = $1
       ) AS joined
       FROM circles c
       ORDER BY c.id`,
      [viewerId],
    );
    return result.rows.map((row) => toCircleItem(row));
  }

  async get(viewerId: string, circleId: string): Promise<CircleItem> {
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
         SELECT 1 FROM circle_members m WHERE m.circle_id = c.id AND m.user_id = $1
       ) AS joined
       FROM circles c
       WHERE c.id = $2`,
      [viewerId, circleId],
    );
    if (!result.rows[0]) {
      throw new AppError(404, ErrorCode.CIRCLE_NOT_FOUND, "圈子不存在");
    }
    return toCircleItem(result.rows[0]);
  }

  async toggleJoin(viewerId: string, circleId: string): Promise<{ joined: boolean; memberCount: number }> {
    await this.get(viewerId, circleId);
    const existing = await this.pg.query("SELECT 1 FROM circle_members WHERE circle_id = $1 AND user_id = $2", [
      circleId,
      viewerId,
    ]);
    if (existing.rows[0]) {
      await this.pg.query("DELETE FROM circle_members WHERE circle_id = $1 AND user_id = $2", [circleId, viewerId]);
      await this.pg.query("UPDATE circles SET member_count = GREATEST(member_count - 1, 0) WHERE id = $1", [circleId]);
    } else {
      await this.pg.query("INSERT INTO circle_members (circle_id, user_id) VALUES ($1, $2)", [circleId, viewerId]);
      await this.pg.query("UPDATE circles SET member_count = member_count + 1 WHERE id = $1", [circleId]);
    }
    const row = await this.pg.query<{ member_count: number }>("SELECT member_count FROM circles WHERE id = $1", [
      circleId,
    ]);
    return { joined: !existing.rows[0], memberCount: row.rows[0].member_count };
  }
}

import type { Pool } from "pg";
import { AppError, ErrorCode } from "../../common/errors.js";
import { newId } from "../../common/ids.js";
import { joinedCircleIds, requireUser, toPublicFor } from "./user.repo.js";
import type { UserPublic } from "../../types.js";

export class UserService {
  constructor(private readonly pg: Pool) {}

  async getMe(userId: string): Promise<UserPublic> {
    const row = await requireUser(this.pg, userId);
    const user = await toPublicFor(this.pg, row, userId);
    user.joinedCircleIds = await joinedCircleIds(this.pg, userId);
    return user;
  }

  async updateMe(userId: string, patch: { nickname?: string; bio?: string; signature?: string }): Promise<UserPublic> {
    const current = await requireUser(this.pg, userId);
    const nickname = patch.nickname !== undefined ? patch.nickname.trim() : current.nickname;
    if (nickname.length < 2) {
      throw new AppError(422, ErrorCode.NICKNAME_TOO_SHORT, "昵称再可爱一点点");
    }
    const bio = patch.bio !== undefined ? patch.bio.trim() : current.bio;
    const signature = patch.signature !== undefined ? patch.signature.trim() : current.signature;
    await this.pg.query(
      `UPDATE users SET nickname = $1, bio = $2, signature = $3, updated_at = now() WHERE id = $4`,
      [nickname, bio, signature, userId],
    );
    return this.getMe(userId);
  }

  async getUser(viewerId: string, userId: string): Promise<UserPublic> {
    const row = await requireUser(this.pg, userId);
    return toPublicFor(this.pg, row, viewerId);
  }

  async toggleFollow(viewerId: string, targetId: string): Promise<{ isFollowing: boolean; followers: number }> {
    if (viewerId === targetId) {
      throw new AppError(400, ErrorCode.FOLLOW_SELF, "不能关注自己");
    }
    await requireUser(this.pg, targetId);
    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2", [
        viewerId,
        targetId,
      ]);
      let following: boolean;
      if (existing.rows[0]) {
        await client.query("DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2", [viewerId, targetId]);
        await client.query("UPDATE users SET following = GREATEST(following - 1, 0) WHERE id = $1", [viewerId]);
        await client.query("UPDATE users SET followers = GREATEST(followers - 1, 0) WHERE id = $1", [targetId]);
        following = false;
      } else {
        await client.query("INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)", [viewerId, targetId]);
        await client.query("UPDATE users SET following = following + 1 WHERE id = $1", [viewerId]);
        await client.query("UPDATE users SET followers = followers + 1 WHERE id = $1", [targetId]);
        following = true;
        const me = await client.query<{ nickname: string }>("SELECT nickname FROM users WHERE id = $1", [viewerId]);
        await client.query(
          `INSERT INTO notices (id, user_id, title, body, kind)
           VALUES ($1, $2, $3, $4, 'follow')`,
          [
            newId("n"),
            targetId,
            `${me.rows[0]?.nickname ?? "有人"} 关注了你`,
            "你们已经在同一个次元里相遇。",
          ],
        );
      }
      const followers = await client.query<{ followers: number }>("SELECT followers FROM users WHERE id = $1", [targetId]);
      await client.query("COMMIT");
      return { isFollowing: following, followers: followers.rows[0].followers };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

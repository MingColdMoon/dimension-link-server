import type { Pool } from "pg";
import { AppError, ErrorCode } from "../../common/errors.js";
import { toUserPublic } from "./user.mapper.js";
import { USER_PUBLIC_COLUMNS, type UserRow } from "./user.types.js";
import type { UserPublic } from "../../types.js";

export async function findUserById(pg: Pool, id: string): Promise<UserRow | undefined> {
  const result = await pg.query<UserRow>(`SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function requireUser(pg: Pool, id: string): Promise<UserRow> {
  const user = await findUserById(pg, id);
  if (!user) {
    throw new AppError(404, ErrorCode.USER_NOT_FOUND, "住民不存在");
  }
  return user;
}

export async function isFollowing(pg: Pool, followerId: string, followeeId: string): Promise<boolean> {
  if (followerId === followeeId) {
    return false;
  }
  const result = await pg.query("SELECT 1 FROM follows WHERE follower_id = $1 AND followee_id = $2", [
    followerId,
    followeeId,
  ]);
  return Boolean(result.rows[0]);
}

export async function toPublicFor(pg: Pool, row: UserRow, viewerId: string): Promise<UserPublic> {
  const following = viewerId === row.id ? false : await isFollowing(pg, viewerId, row.id);
  return toUserPublic(row, following);
}

export async function loadPublicMap(pg: Pool, ids: string[], viewerId: string): Promise<Map<string, UserPublic>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, UserPublic>();
  if (unique.length === 0) {
    return map;
  }
  const result = await pg.query<UserRow>(`SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = ANY($1::text[])`, [
    unique,
  ]);
  const followResult = await pg.query<{ followee_id: string }>(
    "SELECT followee_id FROM follows WHERE follower_id = $1 AND followee_id = ANY($2::text[])",
    [viewerId, unique],
  );
  const followingSet = new Set(followResult.rows.map((row) => row.followee_id));
  for (const row of result.rows) {
    map.set(row.id, toUserPublic(row, row.id === viewerId ? false : followingSet.has(row.id)));
  }
  return map;
}

export async function joinedCircleIds(pg: Pool, userId: string): Promise<string[]> {
  const result = await pg.query<{ circle_id: string }>(
    "SELECT circle_id FROM circle_members WHERE user_id = $1 ORDER BY created_at ASC",
    [userId],
  );
  return result.rows.map((row) => row.circle_id);
}

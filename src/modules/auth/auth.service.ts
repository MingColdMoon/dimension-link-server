import { randomUUID } from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { AppError, ErrorCode } from "../../common/errors.js";
import { displayHandle, newId, normalizeHandle } from "../../common/ids.js";
import { hashPassword, verifyPassword } from "../../common/password.js";
import { isUniqueViolation } from "../../common/pg.js";
import type { AppConfig } from "../../config.js";
import type { UserPublic } from "../../types.js";
import { joinedCircleIds, toPublicFor } from "../users/user.repo.js";
import { DEFAULT_CIRCLE_IDS, USER_PUBLIC_COLUMNS, type UserRow } from "../users/user.types.js";
import { toUserPublic } from "../users/user.mapper.js";

export interface AuthPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserPublic;
}

interface TokenClaims {
  sub: string;
  typ: "access" | "refresh";
  jti: string;
}

export function accessKey(jti: string): string {
  return `token:access:${jti}`;
}

export function refreshKey(jti: string): string {
  return `token:refresh:${jti}`;
}

export function userRefreshSetKey(userId: string): string {
  return `user:refreshes:${userId}`;
}

export class AuthService {
  constructor(
    private readonly pg: Pool,
    private readonly redis: Redis,
    private readonly config: AppConfig,
  ) {}

  async register(input: { nickname?: string; handle?: string; password?: string }): Promise<AuthPayload> {
    const nickname = (input.nickname ?? "").trim();
    if (nickname.length < 2) {
      throw new AppError(422, ErrorCode.NICKNAME_TOO_SHORT, "昵称再可爱一点点");
    }
    const password = input.password ?? "";
    if (password.length < 4) {
      throw new AppError(422, ErrorCode.PASSWORD_TOO_SHORT, "口令至少 4 位");
    }

    let handleCore = normalizeHandle(input.handle ?? "");
    const countResult = await this.pg.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM users");
    const userCount = Number(countResult.rows[0]?.count ?? 0);
    if (!handleCore) {
      handleCore = `user_${userCount}`;
    }
    const handleNormalized = handleCore.toLowerCase();
    const passwordHash = await hashPassword(password);
    const id = newId("u");
    const accentIndex = userCount % 8;

    const client = await this.pg.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query<UserRow>(
        `INSERT INTO users (
           id, nickname, handle, handle_normalized, bio, signature, emoji,
           accent_index, followers, following, level, badges, password_hash
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,0,1,$9,$10)
         RETURNING ${USER_PUBLIC_COLUMNS}`,
        [
          id,
          nickname,
          displayHandle(handleCore),
          handleNormalized,
          "刚刚穿越过来的新住民",
          "请多指教～",
          "✨",
          accentIndex,
          ["初入次元"],
          passwordHash,
        ],
      );
      for (const circleId of DEFAULT_CIRCLE_IDS) {
        await client.query("INSERT INTO circle_members (circle_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
          circleId,
          id,
        ]);
        await client.query("UPDATE circles SET member_count = member_count + 1 WHERE id = $1", [circleId]);
      }
      await client.query("COMMIT");
      const user = toUserPublic(inserted.rows[0], false);
      user.joinedCircleIds = [...DEFAULT_CIRCLE_IDS];
      return this.issueTokens(user);
    } catch (err) {
      await client.query("ROLLBACK");
      if (isUniqueViolation(err)) {
        throw new AppError(409, ErrorCode.HANDLE_TAKEN, "这个 @ 已经被占用啦");
      }
      throw err;
    } finally {
      client.release();
    }
  }

  async login(identifier: string, password: string): Promise<AuthPayload> {
    const key = normalizeHandle(identifier).toLowerCase();
    if (!key) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND_LOGIN, "找不到这位次元住民");
    }
    const result = await this.pg.query<UserRow & { password_hash: string }>(
      `SELECT ${USER_PUBLIC_COLUMNS}, password_hash
       FROM users
       WHERE handle_normalized = $1 OR LOWER(nickname) = $1
       ORDER BY CASE WHEN handle_normalized = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [key],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError(404, ErrorCode.USER_NOT_FOUND_LOGIN, "找不到这位次元住民");
    }
    if (!(await verifyPassword(password, row.password_hash))) {
      throw new AppError(401, ErrorCode.BAD_PASSWORD, "通行证口令不对哦");
    }
    const user = await toPublicFor(this.pg, row, row.id);
    user.joinedCircleIds = await joinedCircleIds(this.pg, row.id);
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthPayload> {
    const claims = this.verifyToken(refreshToken, "refresh");
    const stored = await this.redis.get(refreshKey(claims.jti));
    if (!stored || stored !== claims.sub) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "请先登录");
    }
    await this.redis.del(refreshKey(claims.jti));
    await this.redis.srem(userRefreshSetKey(claims.sub), claims.jti);
    const row = await this.pg.query<UserRow>(`SELECT ${USER_PUBLIC_COLUMNS} FROM users WHERE id = $1`, [claims.sub]);
    if (!row.rows[0]) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "请先登录");
    }
    const user = await toPublicFor(this.pg, row.rows[0], claims.sub);
    user.joinedCircleIds = await joinedCircleIds(this.pg, claims.sub);
    return this.issueTokens(user);
  }

  async logout(userId: string, accessJti: string, refreshToken?: string): Promise<void> {
    await this.redis.del(accessKey(accessJti));
    if (refreshToken) {
      try {
        const claims = this.verifyToken(refreshToken, "refresh");
        await this.redis.del(refreshKey(claims.jti));
        await this.redis.srem(userRefreshSetKey(userId), claims.jti);
      } catch {
        // 刷新令牌无效时仍作废 access
      }
    }
    const jtis = await this.redis.smembers(userRefreshSetKey(userId));
    if (jtis.length > 0) {
      await this.redis.del(...jtis.map(refreshKey), userRefreshSetKey(userId));
    } else {
      await this.redis.del(userRefreshSetKey(userId));
    }
  }

  verifyToken(token: string, typ: "access" | "refresh"): TokenClaims {
    try {
      const payload = jwt.verify(token, this.config.JWT_SECRET) as TokenClaims;
      if (payload.typ !== typ || !payload.sub || !payload.jti) {
        throw new AppError(401, ErrorCode.UNAUTHORIZED, "请先登录");
      }
      return payload;
    } catch (err) {
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "请先登录");
    }
  }

  private async issueTokens(user: UserPublic): Promise<AuthPayload> {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();
    const accessToken = jwt.sign({ sub: user.id, typ: "access", jti: accessJti }, this.config.JWT_SECRET, {
      expiresIn: this.config.JWT_ACCESS_EXPIRES_IN as SignOptions["expiresIn"],
    });
    const refreshToken = jwt.sign({ sub: user.id, typ: "refresh", jti: refreshJti }, this.config.JWT_SECRET, {
      expiresIn: this.config.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"],
    });
    await this.redis.set(accessKey(accessJti), user.id, "EX", this.config.ACCESS_TOKEN_TTL);
    await this.redis.set(refreshKey(refreshJti), user.id, "EX", this.config.REFRESH_TOKEN_TTL);
    await this.redis.sadd(userRefreshSetKey(user.id), refreshJti);
    await this.redis.expire(userRefreshSetKey(user.id), this.config.REFRESH_TOKEN_TTL);
    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.ACCESS_TOKEN_TTL,
      user,
    };
  }
}

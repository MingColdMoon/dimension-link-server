import type { Next } from "koa";
import { AppError, ErrorCode } from "../common/errors.js";
import { accessKey, AuthService } from "../modules/auth/auth.service.js";
import type { AppContext, AppDeps, AuthUser } from "../types.js";

export function requireAuth(deps: AppDeps) {
  const auth = new AuthService(deps.pg, deps.redis, deps.config);
  return async (ctx: AppContext, next: Next): Promise<void> => {
    const header = ctx.get("Authorization");
    if (!header.startsWith("Bearer ")) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "请先登录");
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "请先登录");
    }

    const payload = auth.verifyToken(token, "access");
    const stored = await deps.redis.get(accessKey(payload.jti));
    if (!stored || stored !== payload.sub) {
      throw new AppError(401, ErrorCode.UNAUTHORIZED, "请先登录");
    }

    const user: AuthUser = { id: payload.sub, accessJti: payload.jti };
    ctx.state.user = user;
    await deps.pg.query("UPDATE users SET last_seen_at = now() WHERE id = $1", [user.id]);
    await next();
  };
}

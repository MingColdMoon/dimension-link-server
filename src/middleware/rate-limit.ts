import type { Redis } from "ioredis";
import type { Next } from "koa";
import { AppError, ErrorCode } from "../common/errors.js";
import type { AppContext } from "../types.js";

export async function hitRateLimit(redis: Redis, key: string, limit: number, windowSec: number): Promise<void> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSec);
  }
  if (count > limit) {
    throw new AppError(429, ErrorCode.RATE_LIMITED, "操作太频繁，稍后再试");
  }
}

export function rateLimitByIp(redis: Redis, prefix: string, limit: number, windowSec: number) {
  return async (ctx: AppContext, next: Next): Promise<void> => {
    await hitRateLimit(redis, `${prefix}:${ctx.ip}`, limit, windowSec);
    await next();
  };
}

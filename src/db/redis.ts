import { Redis } from "ioredis";
import type { AppConfig } from "../config.js";

export function createRedis(config: AppConfig): Redis {
  return new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

export async function pingRedis(redis: Redis): Promise<void> {
  const pong = await redis.ping();
  if (pong !== "PONG") {
    throw new Error("Redis ping 失败");
  }
}

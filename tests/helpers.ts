import type Koa from "koa";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import { loadConfig } from "../src/config.js";
import { logger } from "../src/logger.js";
import { createKoaApp } from "../src/app.js";
import { createPostgres, pingPostgres } from "../src/db/postgres.js";
import { createRedis, pingRedis } from "../src/db/redis.js";
import { migrate } from "../src/db/migrate.js";
import { seed } from "../src/db/seed.js";
import type { AppDeps } from "../src/types.js";

export interface TestContext {
  app: Koa;
  deps: AppDeps;
}

let context: TestContext | undefined;

async function retry<T>(fn: () => Promise<T>, times = 30, delayMs = 500): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < times; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export async function getTestContext(): Promise<TestContext> {
  if (context) {
    return context;
  }

  const config = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
  });
  const pg = createPostgres(config);
  const redis = createRedis(config);

  await retry(async () => {
    if (redis.status === "wait") {
      await redis.connect();
    }
    await pingPostgres(pg);
    await pingRedis(redis);
  });
  await migrate(pg);

  const deps: AppDeps = { config, logger, pg, redis };
  const app = createKoaApp(deps);
  context = { app, deps };
  return context;
}

export async function resetData(pg: Pool, redis: Redis): Promise<void> {
  await pg.query(`
    TRUNCATE
      messages, conversation_unreads, conversations, notices,
      comments, post_likes, post_stars, posts,
      circle_members, follows, users, circles
    RESTART IDENTITY CASCADE
  `);
  const keys = [
    ...(await redis.keys("token:*")),
    ...(await redis.keys("user:refreshes:*")),
    ...(await redis.keys("rl:*")),
  ];
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await seed(pg, { force: true });
}

export async function closeTestContext(): Promise<void> {
  if (!context) {
    return;
  }
  context.deps.redis.disconnect();
  await context.deps.pg.end();
  context = undefined;
}

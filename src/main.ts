import type { Server } from "node:http";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { createKoaApp } from "./app.js";
import { createPostgres, pingPostgres } from "./db/postgres.js";
import { createRedis, pingRedis } from "./db/redis.js";
import { migrate } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import type { AppDeps } from "./types.js";

export interface RunningApp {
  server: Server;
  deps: AppDeps;
  close: () => Promise<void>;
}

export async function bootstrap(): Promise<RunningApp> {
  const pg = createPostgres(config);
  const redis = createRedis(config);

  await redis.connect();
  await pingPostgres(pg);
  await pingRedis(redis);
  await migrate(pg);
  await seed(pg);

  const deps: AppDeps = { config, logger, pg, redis };
  const app = createKoaApp(deps);
  const server = app.listen(config.PORT, config.HOST);

  const close = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    redis.disconnect();
    await pg.end();
  };

  logger.info({ host: config.HOST, port: config.PORT }, "Dimension Link 微服务已启动");
  return { server, deps, close };
}

async function main(): Promise<void> {
  const running = await bootstrap();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "收到退出信号，开始优雅关闭");
    try {
      await running.close();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "关闭服务失败");
      process.exit(1);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "服务启动失败");
  process.exit(1);
});

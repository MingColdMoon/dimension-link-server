import Router from "@koa/router";
import type { AppContext, AppDeps, AppState } from "../../types.js";

export function createHealthRouter(deps: AppDeps): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>();

  router.get("/health", async (ctx) => {
    ctx.body = {
      code: 0,
      message: "ok",
      data: {
        status: "ok",
        service: "dimension-link-server",
      },
    };
  });

  router.get("/ready", async (ctx) => {
    await deps.pg.query("SELECT 1");
    const pong = await deps.redis.ping();
    ctx.body = {
      code: 0,
      message: "ok",
      data: {
        status: "ready",
        postgres: true,
        redis: pong === "PONG",
      },
    };
  });

  return router;
}

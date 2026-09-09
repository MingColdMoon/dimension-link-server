import Router from "@koa/router";
import { ok } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import type { AppContext, AppDeps, AppState } from "../../types.js";
import { CircleService } from "./circles.service.js";

export function createCircleRouter(deps: AppDeps): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>({ prefix: "/v1/circles" });
  const service = new CircleService(deps.pg);
  router.use(requireAuth(deps));

  router.get("/", async (ctx) => {
    ctx.body = ok(await service.list(ctx.state.user!.id));
  });

  router.get("/:circleId", async (ctx) => {
    ctx.body = ok(await service.get(ctx.state.user!.id, ctx.params.circleId));
  });

  router.post("/:circleId/join", async (ctx) => {
    ctx.body = ok(await service.toggleJoin(ctx.state.user!.id, ctx.params.circleId));
  });

  return router;
}

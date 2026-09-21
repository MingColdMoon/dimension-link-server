import Router from "@koa/router";
import { firstQuery, ok, parseLimit } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import type { AppContext, AppDeps, AppState } from "../../types.js";
import { MatchService } from "./match.service.js";

export function createMatchRouter(deps: AppDeps): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>({ prefix: "/v1" });
  const service = new MatchService(deps.pg);
  router.use(requireAuth(deps));

  router.get("/match/recommend", async (ctx) => {
    const items = await service.recommend(ctx.state.user!.id, firstQuery(ctx.query.mode), parseLimit(ctx.query.limit));
    ctx.body = ok({ items, nextCursor: null, hasMore: false });
  });

  router.post("/match/:userId/like", async (ctx) => {
    ctx.body = ok(await service.like(ctx.state.user!.id, ctx.params.userId));
  });

  return router;
}

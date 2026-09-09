import Router from "@koa/router";
import { firstQuery, ok, parseLimit } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import type { AppContext, AppDeps, AppState } from "../../types.js";
import { SearchService } from "./search.service.js";

export function createSearchRouter(deps: AppDeps): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>({ prefix: "/v1" });
  const service = new SearchService(deps.pg, deps.redis);
  router.use(requireAuth(deps));

  router.get("/search", async (ctx) => {
    const q = firstQuery(ctx.query.q) ?? "";
    ctx.body = ok(await service.search(ctx.state.user!.id, q, parseLimit(ctx.query.limit)));
  });

  return router;
}

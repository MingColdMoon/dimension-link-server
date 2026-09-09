import Router from "@koa/router";
import { firstQuery, ok, parseLimit } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import type { AppContext, AppDeps, AppState } from "../../types.js";
import { NoticeService } from "./notices.service.js";

export function createNoticeRouter(deps: AppDeps): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>({ prefix: "/v1/notices" });
  const service = new NoticeService(deps.pg);
  router.use(requireAuth(deps));

  router.get("/", async (ctx) => {
    ctx.body = ok(
      await service.list(ctx.state.user!.id, {
        cursor: firstQuery(ctx.query.cursor),
        limit: parseLimit(ctx.query.limit),
      }),
    );
  });

  return router;
}

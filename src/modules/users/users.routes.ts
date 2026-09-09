import Router from "@koa/router";
import { z } from "zod";
import { ok, parseBody } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import type { AppContext, AppDeps, AppState } from "../../types.js";
import { UserService } from "./users.service.js";

const patchSchema = z.object({
  nickname: z.string().optional(),
  bio: z.string().optional(),
  signature: z.string().optional(),
});

export function createUserRouter(deps: AppDeps): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>({ prefix: "/v1" });
  const service = new UserService(deps.pg);
  const auth = requireAuth(deps);

  router.get("/me", auth, async (ctx) => {
    ctx.body = ok(await service.getMe(ctx.state.user!.id));
  });

  router.patch("/me", auth, async (ctx) => {
    const patch = parseBody(patchSchema, ctx.request.body ?? {});
    ctx.body = ok(await service.updateMe(ctx.state.user!.id, patch));
  });

  router.get("/users/:userId", auth, async (ctx) => {
    ctx.body = ok(await service.getUser(ctx.state.user!.id, ctx.params.userId));
  });

  router.post("/users/:userId/follow", auth, async (ctx) => {
    ctx.body = ok(await service.toggleFollow(ctx.state.user!.id, ctx.params.userId));
  });

  return router;
}

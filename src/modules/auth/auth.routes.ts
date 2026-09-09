import Router from "@koa/router";
import { z } from "zod";
import { ok, parseBody } from "../../common/http.js";
import { rateLimitByIp } from "../../middleware/rate-limit.js";
import { requireAuth } from "../../middleware/auth.js";
import type { AppContext, AppDeps, AppState } from "../../types.js";
import { AuthService } from "./auth.service.js";

const registerSchema = z.object({
  nickname: z.string().optional(),
  handle: z.string().optional(),
  password: z.string().optional(),
});

const loginSchema = z.object({
  identifier: z.string().optional(),
  password: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, "请先登录"),
});

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

export function createAuthRouter(deps: AppDeps): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>({ prefix: "/v1/auth" });
  const service = new AuthService(deps.pg, deps.redis, deps.config);
  const authLimit = rateLimitByIp(deps.redis, "rl:auth", 20, 600);

  router.post("/register", authLimit, async (ctx) => {
    const input = parseBody(registerSchema, ctx.request.body);
    ctx.body = ok(await service.register(input));
  });

  router.post("/login", authLimit, async (ctx) => {
    const input = parseBody(loginSchema, ctx.request.body);
    ctx.body = ok(await service.login(input.identifier ?? "", input.password ?? ""));
  });

  router.post("/refresh", async (ctx) => {
    const input = parseBody(refreshSchema, ctx.request.body);
    ctx.body = ok(await service.refresh(input.refreshToken));
  });

  router.post("/logout", requireAuth(deps), async (ctx) => {
    const input = parseBody(logoutSchema, ctx.request.body ?? {});
    const user = ctx.state.user!;
    await service.logout(user.id, user.accessJti, input.refreshToken);
    ctx.body = ok({ success: true });
  });

  return router;
}

import Koa from "koa";
import cors from "@koa/cors";
import { bodyParser } from "@koa/bodyparser";
import { errorHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createCircleRouter } from "./modules/circles/circles.routes.js";
import { createConversationRouter } from "./modules/conversations/conversations.routes.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createNoticeRouter } from "./modules/notices/notices.routes.js";
import { createPostRouter } from "./modules/posts/posts.routes.js";
import { createSearchRouter } from "./modules/search/search.routes.js";
import { createUserRouter } from "./modules/users/users.routes.js";
import { createSwaggerRouter } from "./docs/swagger.routes.js";
import type { AppDeps } from "./types.js";

export function createKoaApp(deps: AppDeps): Koa {
  const app = new Koa();
  app.proxy = true;

  app.use(errorHandler(deps.logger));
  app.use(requestId);
  app.use(
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    }),
  );
  app.use(bodyParser({ encoding: "utf-8", enableTypes: ["json"] }));

  const routers = [
    createSwaggerRouter(),
    createHealthRouter(deps),
    createAuthRouter(deps),
    createUserRouter(deps),
    createPostRouter(deps),
    createCircleRouter(deps),
    createConversationRouter(deps),
    createNoticeRouter(deps),
    createSearchRouter(deps),
  ];

  for (const router of routers) {
    app.use(router.routes());
    app.use(router.allowedMethods());
  }

  app.use(async (ctx) => {
    if (ctx.status === 404 && ctx.body === undefined) {
      ctx.status = 404;
      ctx.body = { code: 40401, message: "接口不存在", data: null };
    }
  });

  return app;
}

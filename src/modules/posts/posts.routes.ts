import Router from "@koa/router";
import { z } from "zod";
import { firstQuery, ok, parseBody, parseLimit } from "../../common/http.js";
import { requireAuth } from "../../middleware/auth.js";
import type { AppContext, AppDeps, AppState } from "../../types.js";
import { PostService } from "./posts.service.js";

const composeSchema = z.object({
  content: z.string().optional(),
  circleId: z.string().optional(),
  mood: z.string().optional(),
  imageTitle: z.string().optional(),
  imageHue: z.number().optional(),
});

const commentSchema = z.object({
  content: z.string().optional(),
});

export function createPostRouter(deps: AppDeps): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>({ prefix: "/v1/posts" });
  const service = new PostService(deps.pg, deps.redis);
  const auth = requireAuth(deps);
  router.use(auth);

  router.get("/", async (ctx) => {
    const data = await service.list(ctx.state.user!.id, {
      cursor: firstQuery(ctx.query.cursor),
      limit: parseLimit(ctx.query.limit),
      authorId: firstQuery(ctx.query.authorId),
      circleId: firstQuery(ctx.query.circleId),
    });
    ctx.body = ok(data);
  });

  router.post("/", async (ctx) => {
    const input = parseBody(composeSchema, ctx.request.body ?? {});
    ctx.body = ok(await service.create(ctx.state.user!.id, input));
  });

  router.get("/:postId", async (ctx) => {
    ctx.body = ok(await service.get(ctx.state.user!.id, ctx.params.postId));
  });

  router.post("/:postId/like", async (ctx) => {
    ctx.body = ok(await service.toggleLike(ctx.state.user!.id, ctx.params.postId));
  });

  router.post("/:postId/star", async (ctx) => {
    ctx.body = ok(await service.toggleStar(ctx.state.user!.id, ctx.params.postId));
  });

  router.get("/:postId/comments", async (ctx) => {
    ctx.body = ok(
      await service.listComments(ctx.state.user!.id, ctx.params.postId, {
        cursor: firstQuery(ctx.query.cursor),
        limit: parseLimit(ctx.query.limit),
      }),
    );
  });

  router.post("/:postId/comments", async (ctx) => {
    const input = parseBody(commentSchema, ctx.request.body ?? {});
    ctx.body = ok(await service.addComment(ctx.state.user!.id, ctx.params.postId, input.content));
  });

  return router;
}

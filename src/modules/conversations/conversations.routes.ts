import Router from "@koa/router";
import { z } from "zod";
import { firstQuery, ok, parseBody, parseLimit } from "../../common/http.js";
import { AppError, ErrorCode } from "../../common/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import type { AppContext, AppDeps, AppState } from "../../types.js";
import { ConversationService } from "./conversations.service.js";

const ensureSchema = z.object({
  peerId: z.string().min(1).optional(),
  memberIds: z.array(z.string()).optional(),
  title: z.string().optional(),
});

const messageSchema = z.object({
  text: z.string().optional(),
});

export function createConversationRouter(deps: AppDeps): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>({ prefix: "/v1/conversations" });
  const service = new ConversationService(deps.pg, deps.redis);
  router.use(requireAuth(deps));

  router.get("/", async (ctx) => {
    ctx.body = ok(await service.list(ctx.state.user!.id));
  });

  router.post("/", async (ctx) => {
    const input = parseBody(ensureSchema, ctx.request.body ?? {});
    const memberIds = input.memberIds ?? [];
    if (memberIds.length > 0) {
      ctx.body = ok(await service.createGroup(ctx.state.user!.id, memberIds, input.title));
      return;
    }
    if (!input.peerId) {
      throw new AppError(422, ErrorCode.GROUP_TOO_SMALL, "请选择私聊对象或拉群成员");
    }
    ctx.body = ok(await service.ensure(ctx.state.user!.id, input.peerId));
  });

  router.get("/:id/messages", async (ctx) => {
    ctx.body = ok(
      await service.listMessages(ctx.state.user!.id, ctx.params.id, {
        cursor: firstQuery(ctx.query.cursor),
        limit: parseLimit(ctx.query.limit),
      }),
    );
  });

  router.post("/:id/messages", async (ctx) => {
    const input = parseBody(messageSchema, ctx.request.body ?? {});
    ctx.body = ok(await service.send(ctx.state.user!.id, ctx.params.id, input.text));
  });

  router.post("/:id/read", async (ctx) => {
    ctx.body = ok(await service.markRead(ctx.state.user!.id, ctx.params.id));
  });

  return router;
}

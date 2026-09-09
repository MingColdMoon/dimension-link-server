import { randomUUID } from "node:crypto";
import type { Next } from "koa";
import type { AppContext } from "../types.js";

export async function requestId(ctx: AppContext, next: Next): Promise<void> {
  const incoming = ctx.get("X-Request-Id");
  ctx.state.requestId = incoming || randomUUID();
  ctx.set("X-Request-Id", ctx.state.requestId);
  await next();
}

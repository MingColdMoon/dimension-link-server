import type { Next } from "koa";
import { AppError, ErrorCode } from "../common/errors.js";
import type { AppContext } from "../types.js";
import type { Logger } from "pino";

export function errorHandler(logger: Logger) {
  return async (ctx: AppContext, next: Next): Promise<void> => {
    try {
      await next();
    } catch (err) {
      if (err instanceof AppError) {
        ctx.status = err.status;
        ctx.body = {
          code: err.code,
          message: err.message,
          data: null,
        };
        return;
      }

      logger.error({ err, requestId: ctx.state.requestId }, "未处理异常");
      ctx.status = 500;
      ctx.body = {
        code: ErrorCode.INTERNAL,
        message: "次元暂时断开了",
        data: null,
      };
    }
  };
}

import { createRequire } from "node:module";
import pino from "pino";
import { config } from "./config.js";

const require = createRequire(import.meta.url);

/** 未安装 pino-pretty（生产 --omit=dev）时回退为 JSON 日志，避免进程直接退出 */
function resolvePrettyTransport() {
  if (config.NODE_ENV === "production" || config.NODE_ENV === "test") {
    return undefined;
  }
  try {
    require.resolve("pino-pretty");
  } catch {
    return undefined;
  }
  return {
    target: "pino-pretty",
    options: { colorize: true, translateTime: "SYS:standard" },
  };
}

export const logger = pino({
  level: config.NODE_ENV === "test" ? "silent" : config.LOG_LEVEL,
  transport: resolvePrettyTransport(),
});

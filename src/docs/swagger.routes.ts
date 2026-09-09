import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import Router from "@koa/router";
import type { AppContext, AppState } from "../types.js";
import { openApiDocument } from "./openapi.js";

const require = createRequire(import.meta.url);
const swaggerAssetDir = path.dirname(require.resolve("swagger-ui-dist/swagger-ui.css"));

const ALLOWED_ASSETS = new Set([
  "swagger-ui.css",
  "swagger-ui-bundle.js",
  "swagger-ui-standalone-preset.js",
  "favicon-32x32.png",
  "favicon-16x16.png",
]);

function swaggerHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>次元链接 API · Swagger</title>
    <link rel="stylesheet" href="/docs/assets/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/docs/assets/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/docs/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        persistAuthorization: true,
        defaultModelsExpandDepth: 1,
      });
    </script>
  </body>
</html>`;
}

/** 提供 Swagger UI 与 OpenAPI JSON，无需登录 */
export function createSwaggerRouter(): Router<AppState, AppContext> {
  const router = new Router<AppState, AppContext>();

  router.get("/docs", async (ctx) => {
    ctx.type = "html";
    ctx.body = swaggerHtml();
  });

  router.get("/docs/", async (ctx) => {
    ctx.redirect("/docs");
  });

  router.get("/docs/openapi.json", async (ctx) => {
    ctx.type = "json";
    ctx.body = openApiDocument;
  });

  router.get("/docs/assets/:file", async (ctx) => {
    const file = ctx.params.file;
    if (!ALLOWED_ASSETS.has(file)) {
      ctx.status = 404;
      ctx.body = { code: 40401, message: "接口不存在", data: null };
      return;
    }
    const fullPath = path.join(swaggerAssetDir, file);
    const info = await stat(fullPath);
    if (!info.isFile()) {
      ctx.status = 404;
      ctx.body = { code: 40401, message: "接口不存在", data: null };
      return;
    }
    ctx.type = path.extname(file);
    ctx.body = createReadStream(fullPath);
  });

  return router;
}

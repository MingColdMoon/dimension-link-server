import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { getTestContext, resetData, type TestContext } from "./helpers.js";

describe("健康检查", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await getTestContext();
  });

  beforeEach(async () => {
    await resetData(ctx.deps.pg, ctx.deps.redis);
  });

  it("GET /health 与 /ready", async () => {
    const health = await request(ctx.app.callback()).get("/health");
    expect(health.status).toBe(200);
    expect(health.body.data.service).toBe("dimension-link-server");

    const ready = await request(ctx.app.callback()).get("/ready");
    expect(ready.status).toBe(200);
    expect(ready.body.data.postgres).toBe(true);
    expect(ready.body.data.redis).toBe(true);
  });

  it("Swagger OpenAPI 文档可访问", async () => {
    const spec = await request(ctx.app.callback()).get("/docs/openapi.json");
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toMatch(/^3\./);
    expect(spec.body.paths["/v1/auth/login"]).toBeTruthy();
    expect(spec.body.paths["/v1/posts"]).toBeTruthy();

    const ui = await request(ctx.app.callback()).get("/docs");
    expect(ui.status).toBe(200);
    expect(String(ui.text)).toContain("swagger-ui");
  });
});

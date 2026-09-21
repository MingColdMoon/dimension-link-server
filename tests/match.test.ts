import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { getTestContext, resetData, type TestContext } from "./helpers.js";

async function login(app: TestContext["app"], identifier = "星野铃", password = "123456") {
  return request(app.callback()).post("/v1/auth/login").send({ identifier, password });
}

describe("次元匹配 API", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await getTestContext();
  });

  beforeEach(async () => {
    await resetData(ctx.deps.pg, ctx.deps.redis);
  });

  it("附近推荐把更近的住民排在前面，且不含自己", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const res = await request(ctx.app.callback())
      .get("/v1/match/recommend")
      .query({ mode: "nearby", limit: 20 })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{
      user: { id: string };
      mode: string;
      score: number;
      distanceKm: number;
      city: string;
    }>;
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.every((item) => item.user.id !== "u_me")).toBe(true);
    expect(items[0].user.id).toBe("u_yukimi");
    expect(items[0].mode).toBe("nearby");
    expect(items[0].distanceKm).toBeLessThan(1);
    expect(items[0].city).toBe("上海");
    expect(items[0].distanceKm).toBeLessThan(items.at(-1)!.distanceKm);
  });

  it("同好推荐会点亮重叠爱好", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const res = await request(ctx.app.callback())
      .get("/v1/match/recommend")
      .query({ mode: "hobby" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const yukimi = (res.body.data.items as Array<{ user: { id: string }; sharedHobbies: string[]; score: number; reason: string }>).find(
      (item) => item.user.id === "u_yukimi",
    );
    expect(yukimi).toBeTruthy();
    expect(yukimi!.sharedHobbies).toEqual(expect.arrayContaining(["插画", "同人"]));
    expect(yukimi!.score).toBeGreaterThan(60);
    expect(yukimi!.reason).toContain("共同爱好");
  });

  it("默契推荐分数落在 1-99", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const res = await request(ctx.app.callback())
      .get("/v1/match/recommend")
      .query({ mode: "affinity" })
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    const items = res.body.data.items as Array<{ score: number; mode: string }>;
    expect(items.every((item) => item.mode === "affinity")).toBe(true);
    expect(items.every((item) => item.score >= 1 && item.score <= 99)).toBe(true);
  });

  it("心动自己返回 1012，成功后会关注并移出推荐", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const self = await request(ctx.app.callback()).post("/v1/match/u_me/like").set(auth);
    expect(self.status).toBe(400);
    expect(self.body.code).toBe(1012);

    const missing = await request(ctx.app.callback()).post("/v1/match/u_nobody/like").set(auth);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe(1010);

    const liked = await request(ctx.app.callback()).post("/v1/match/u_yukimi/like").set(auth);
    expect(liked.status).toBe(200);
    expect(liked.body.data.liked).toBe(true);

    const again = await request(ctx.app.callback()).post("/v1/match/u_yukimi/like").set(auth);
    expect(again.body.data.liked).toBe(true);

    const profile = await request(ctx.app.callback()).get("/v1/users/u_yukimi").set(auth);
    expect(profile.body.data.isFollowing).toBe(true);

    const nearby = await request(ctx.app.callback()).get("/v1/match/recommend").query({ mode: "nearby" }).set(auth);
    expect((nearby.body.data.items as Array<{ user: { id: string } }>).some((item) => item.user.id === "u_yukimi")).toBe(
      false,
    );
  });
});

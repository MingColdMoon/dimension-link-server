import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { getTestContext, resetData, type TestContext } from "./helpers.js";

async function login(app: TestContext["app"], identifier = "星野铃", password = "123456") {
  return request(app.callback()).post("/v1/auth/login").send({ identifier, password });
}

describe("次元链接社交 API", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await getTestContext();
  });

  beforeEach(async () => {
    await resetData(ctx.deps.pg, ctx.deps.redis);
  });

  it("登录错误码与文案符合契约", async () => {
    const missing = await login(ctx.app, "不存在的人", "123456");
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe(1001);
    expect(missing.body.message).toBe("找不到这位次元住民");

    const wrong = await login(ctx.app, "星野铃", "wrong");
    expect(wrong.status).toBe(401);
    expect(wrong.body.code).toBe(1002);
    expect(wrong.body.message).toBe("通行证口令不对哦");
  });

  it("注册重复 handle 冲突，成功后可拉当前用户", async () => {
    const duplicated = await request(ctx.app.callback()).post("/v1/auth/register").send({
      nickname: "新人",
      handle: "hoshi_suzu",
      password: "123456",
    });
    expect(duplicated.status).toBe(409);
    expect(duplicated.body.message).toBe("这个 @ 已经被占用啦");

    const registered = await request(ctx.app.callback()).post("/v1/auth/register").send({
      nickname: "路过的猫",
      handle: "new_cat",
      password: "1234",
    });
    expect(registered.status).toBe(200);
    expect(registered.body.data.accessToken).toBeTruthy();
    expect(registered.body.data.user.handle).toBe("@new_cat");
    expect(registered.body.data.user.joinedCircleIds).toEqual(["c_doujin", "c_cos", "c_anime"]);

    const me = await request(ctx.app.callback())
      .get("/v1/me")
      .set("Authorization", `Bearer ${registered.body.data.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.nickname).toBe("路过的猫");
  });

  it("广场动态倒序，并含作者、圈子、心情与计数", async () => {
    const session = await login(ctx.app);
    const token = session.body.data.accessToken as string;
    const feed = await request(ctx.app.callback()).get("/v1/posts").set("Authorization", `Bearer ${token}`);
    expect(feed.status).toBe(200);
    const items = feed.body.data.items as Array<{ id: string; createdAt: string; author: { nickname: string }; circle: { id: string }; mood: string }>;
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items[0].id).toBe("p1");
    for (let i = 1; i < items.length; i += 1) {
      expect(new Date(items[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(items[i].createdAt).getTime());
    }
    expect(items[0].author.nickname).toBe("桜井澪");
    expect(items[0].circle.id).toBe("c_cos");
    expect(items[0].mood).toBe("excited");
  });

  it("发布动态后出现在广场与我的", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const created = await request(ctx.app.callback())
      .post("/v1/posts")
      .set("Authorization", `Bearer ${token}`)
      .send({ content: "今日色卡练习", circleId: "c_art", mood: "happy", imageTitle: "薄荷青" });
    expect(created.status).toBe(200);
    const postId = created.body.data.id as string;

    const feed = await request(ctx.app.callback()).get("/v1/posts").set("Authorization", `Bearer ${token}`);
    expect(feed.body.data.items[0].id).toBe(postId);

    const mine = await request(ctx.app.callback())
      .get("/v1/posts")
      .query({ authorId: "u_me" })
      .set("Authorization", `Bearer ${token}`);
    expect(mine.body.data.items.some((item: { id: string }) => item.id === postId)).toBe(true);
  });

  it("点赞与星标可 toggle，评论会写入详情", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const unlike = await request(ctx.app.callback()).post("/v1/posts/p1/like").set(auth);
    expect(unlike.body.data.liked).toBe(false);
    const likeAgain = await request(ctx.app.callback()).post("/v1/posts/p1/like").set(auth);
    expect(likeAgain.body.data.liked).toBe(true);

    const star = await request(ctx.app.callback()).post("/v1/posts/p1/star").set(auth);
    expect(star.body.data.starred).toBe(true);
    const unstar = await request(ctx.app.callback()).post("/v1/posts/p1/star").set(auth);
    expect(unstar.body.data.starred).toBe(false);

    const comment = await request(ctx.app.callback())
      .post("/v1/posts/p1/comments")
      .set(auth)
      .send({ content: "返图太好看了" });
    expect(comment.status).toBe(200);
    const comments = await request(ctx.app.callback()).get("/v1/posts/p1/comments").set(auth);
    expect(comments.body.data.items.at(-1).content).toBe("返图太好看了");
  });

  it("加入退出圈子会更新 joined 与 memberCount", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };
    const before = await request(ctx.app.callback()).get("/v1/circles/c_game").set(auth);
    expect(before.body.data.joined).toBe(false);
    const joined = await request(ctx.app.callback()).post("/v1/circles/c_game/join").set(auth);
    expect(joined.body.data.joined).toBe(true);
    expect(joined.body.data.memberCount).toBe(before.body.data.memberCount + 1);
    const left = await request(ctx.app.callback()).post("/v1/circles/c_game/join").set(auth);
    expect(left.body.data.joined).toBe(false);
    expect(left.body.data.memberCount).toBe(before.body.data.memberCount);
  });

  it("关注他人后可发私信，未读与已读符合规则", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const followSelf = await request(ctx.app.callback()).post("/v1/users/u_me/follow").set(auth);
    expect(followSelf.status).toBe(400);
    expect(followSelf.body.code).toBe(1012);

    const follow = await request(ctx.app.callback()).post("/v1/users/u_nanami/follow").set(auth);
    expect(follow.body.data.isFollowing).toBe(true);

    const conv = await request(ctx.app.callback()).post("/v1/conversations").set(auth).send({ peerId: "u_nanami" });
    expect(conv.status).toBe(200);
    const convId = conv.body.data.id as string;

    const sent = await request(ctx.app.callback())
      .post(`/v1/conversations/${convId}/messages`)
      .set(auth)
      .send({ text: "今晚电台听哪首？" });
    expect(sent.status).toBe(200);

    const nanami = await login(ctx.app, "七海音");
    const peerAuth = { Authorization: `Bearer ${nanami.body.data.accessToken}` };
    const peerList = await request(ctx.app.callback()).get("/v1/conversations").set(peerAuth);
    const peerConv = peerList.body.data.find((item: { id: string }) => item.id === convId);
    expect(peerConv.unread).toBeGreaterThanOrEqual(1);

    const read = await request(ctx.app.callback()).post(`/v1/conversations/${convId}/read`).set(peerAuth);
    expect(read.body.data.unread).toBe(0);
  });

  it("可以拉群，群消息会增加其他成员未读", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };
    const created = await request(ctx.app.callback()).post("/v1/conversations").set(auth).send({
      memberIds: ["u_sakurai", "u_tsukimi"],
      title: "漫展小队",
    });
    expect(created.status).toBe(200);
    expect(created.body.data.kind).toBe("group");
    expect(created.body.data.title).toBe("漫展小队");
    expect(created.body.data.members.length).toBe(3);
    const convId = created.body.data.id as string;

    const sent = await request(ctx.app.callback())
      .post(`/v1/conversations/${convId}/messages`)
      .set(auth)
      .send({ text: "集合啦" });
    expect(sent.status).toBe(200);

    const sakurai = await login(ctx.app, "桜井澪");
    const peerAuth = { Authorization: `Bearer ${sakurai.body.data.accessToken}` };
    const peerList = await request(ctx.app.callback()).get("/v1/conversations").set(peerAuth);
    const peerConv = peerList.body.data.find((item: { id: string }) => item.id === convId);
    expect(peerConv.kind).toBe("group");
    expect(peerConv.unread).toBeGreaterThanOrEqual(1);
  });

  it("搜索开黑命中动态，搜索桜井命中用户", async () => {
    const token = (await login(ctx.app)).body.data.accessToken as string;
    const auth = { Authorization: `Bearer ${token}` };

    const posts = await request(ctx.app.callback()).get("/v1/search").query({ q: "开黑" }).set(auth);
    expect(posts.body.data.posts.some((item: { id: string }) => item.id === "p5")).toBe(true);

    const users = await request(ctx.app.callback()).get("/v1/search").query({ q: "桜井" }).set(auth);
    expect(users.body.data.users.some((item: { nickname: string }) => item.nickname === "桜井澪")).toBe(true);
  });

  it("token 失效后写接口返回 请先登录", async () => {
    const denied = await request(ctx.app.callback()).post("/v1/posts").send({ content: "x", circleId: "c_art" });
    expect(denied.status).toBe(401);
    expect(denied.body.message).toBe("请先登录");

    const expired = await request(ctx.app.callback())
      .post("/v1/posts")
      .set("Authorization", "Bearer not-a-token")
      .send({ content: "x", circleId: "c_art" });
    expect(expired.status).toBe(401);
  });

  it("登出后 accessToken 立即失效", async () => {
    const session = await login(ctx.app);
    const token = session.body.data.accessToken as string;
    const logout = await request(ctx.app.callback())
      .post("/v1/auth/logout")
      .set("Authorization", `Bearer ${token}`)
      .send({ refreshToken: session.body.data.refreshToken });
    expect(logout.status).toBe(200);
    const me = await request(ctx.app.callback()).get("/v1/me").set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(401);
  });
});

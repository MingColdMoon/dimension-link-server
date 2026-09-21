import { describe, expect, it } from "vitest";
import { distanceKm, inferHobbies, recommend, resolvePortrait } from "../src/modules/match/match.engine.js";
import type { MatchScoreInput } from "../src/modules/match/match.types.js";

function user(partial: Partial<MatchScoreInput> & Pick<MatchScoreInput, "id" | "nickname">): MatchScoreInput {
  return {
    bio: "",
    signature: "",
    badges: [],
    hobbies: [],
    city: "",
    district: "",
    latitude: null,
    longitude: null,
    level: 18,
    isFollowing: false,
    lastSeenAt: null,
    circleHints: [],
    postedCircleIds: [],
    ...partial,
  };
}

const me = user({
  id: "u_me",
  nickname: "星野铃",
  bio: "插画练习生 / 偶尔也写一点短篇同人",
  hobbies: ["插画", "同人", "配色", "短篇"],
  city: "上海",
  district: "徐汇",
  latitude: 31.1886,
  longitude: 121.437,
  lastSeenAt: new Date(),
});

const yukimi = user({
  id: "u_yukimi",
  nickname: "雪见白",
  bio: "水彩插画练习生",
  hobbies: ["插画", "水彩", "同人", "配色"],
  city: "上海",
  district: "徐汇",
  latitude: 31.191,
  longitude: 121.441,
  lastSeenAt: new Date(),
});

const tanuki = user({
  id: "u_tanuki",
  nickname: "狸猫不吃鱼",
  bio: "番剧安利人",
  hobbies: ["番剧", "安利", "催泪", "新番"],
  city: "北京",
  district: "朝阳",
  latitude: 39.921,
  longitude: 116.443,
});

describe("匹配推荐引擎", () => {
  it("雪见白与星野铃的直线距离小于一公里", () => {
    expect(distanceKm(resolvePortrait(me), resolvePortrait(yukimi))).toBeLessThan(1);
  });

  it("附近推荐把更近的住民排在前面", () => {
    const list = recommend(me, [tanuki, yukimi], "nearby");
    expect(list[0]?.userId).toBe("u_yukimi");
    expect(list[0]?.distanceKm).toBeLessThan(list[1]!.distanceKm);
  });

  it("同好推荐会点亮重叠爱好", () => {
    const list = recommend(me, [yukimi, tanuki], "hobby");
    const hit = list.find((item) => item.userId === "u_yukimi");
    expect(hit?.sharedHobbies).toEqual(expect.arrayContaining(["插画", "同人"]));
    expect(hit?.score).toBeGreaterThan(60);
    expect(inferHobbies(me)).toEqual(expect.arrayContaining(["插画", "同人"]));
  });

  it("默契分落在 1-99", () => {
    const list = recommend(me, [yukimi, tanuki], "affinity");
    expect(list.every((item) => item.score >= 1 && item.score <= 99)).toBe(true);
  });
});

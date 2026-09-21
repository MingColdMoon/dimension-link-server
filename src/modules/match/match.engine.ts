import type { MatchCandidate, MatchMode, MatchPortrait, MatchScoreInput } from "./match.types.js";

const ONLINE_WINDOW_MS = 15 * 60 * 1000;

const HOBBY_LEXICON: Record<string, string[]> = {
  插画: ["插画", "绘圈", "速写", "厚涂", "配色", "水彩", "画"],
  同人: ["同人", "短篇", "连载", "乙女", "群像", "CP"],
  COS: ["COS", "COSER", "漫展", "妆造", "假发", "约拍", "夜拍"],
  番剧: ["番剧", "安利", "新番", "催泪", "片子"],
  游戏: ["游戏", "开黑", "排位", "主播", "音游", "辅助"],
  声优: ["声优", "电台", "耳机", "广播剧", "角色歌", "切片"],
};

const COMPLEMENTARY: Record<string, string[]> = {
  插画: ["COS", "同人"],
  同人: ["番剧", "声优", "插画"],
  COS: ["插画", "漫展"],
  番剧: ["同人", "声优"],
  游戏: ["声优", "COS"],
  声优: ["同人", "游戏"],
};

const FALLBACK_CITIES: MatchPortrait[] = [
  { city: "上海", district: "徐汇", latitude: 31.1886, longitude: 121.437 },
  { city: "上海", district: "浦东", latitude: 31.2211, longitude: 121.544 },
  { city: "杭州", district: "西湖", latitude: 30.259, longitude: 120.13 },
  { city: "北京", district: "朝阳", latitude: 39.921, longitude: 116.443 },
  { city: "广州", district: "天河", latitude: 23.135, longitude: 113.326 },
  { city: "成都", district: "武侯", latitude: 30.642, longitude: 104.043 },
];

export function parseMatchMode(raw: string | undefined): MatchMode {
  if (raw === "nearby" || raw === "hobby" || raw === "affinity") {
    return raw;
  }
  return "affinity";
}

export function inferHobbies(input: {
  bio: string;
  signature: string;
  badges: string[];
  hobbies: string[];
  extra?: string[];
}): string[] {
  const collected = new Set<string>([...input.hobbies, ...(input.extra ?? [])]);
  const corpus = [input.bio, input.signature, ...input.badges, ...(input.extra ?? [])].join(" ");
  for (const [hobby, keys] of Object.entries(HOBBY_LEXICON)) {
    if (keys.some((key) => corpus.includes(key))) {
      collected.add(hobby);
    }
  }
  return [...collected];
}

export function resolvePortrait(input: {
  id: string;
  city: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
}): MatchPortrait {
  if (input.latitude != null && input.longitude != null && input.city) {
    return {
      city: input.city,
      district: input.district,
      latitude: input.latitude,
      longitude: input.longitude,
    };
  }
  const spot = FALLBACK_CITIES[hashId(input.id) % FALLBACK_CITIES.length]!;
  return {
    city: input.city || spot.city,
    district: input.district || spot.district,
    latitude: input.latitude ?? spot.latitude,
    longitude: input.longitude ?? spot.longitude,
  };
}

export function distanceKm(a: MatchPortrait, b: MatchPortrait): number {
  const earth = 6371;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const hav =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.sqrt(Math.min(1, Math.max(0, hav))));
}

export function isOnline(lastSeenAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) {
    return false;
  }
  const at = lastSeenAt instanceof Date ? lastSeenAt.getTime() : new Date(lastSeenAt).getTime();
  return now - at <= ONLINE_WINDOW_MS;
}

export function recommend(me: MatchScoreInput, others: MatchScoreInput[], mode: MatchMode): MatchCandidate[] {
  const mePortrait = resolvePortrait(me);
  const myHobbies = inferHobbies({ ...me, extra: me.circleHints });
  const scored = others.map((user) => scoreOne(me, mePortrait, myHobbies, user, mode));
  scored.sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) {
      return byScore;
    }
    return (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999);
  });
  return scored;
}

function scoreOne(
  me: MatchScoreInput,
  mePortrait: MatchPortrait,
  myHobbies: string[],
  user: MatchScoreInput,
  mode: MatchMode,
): MatchCandidate {
  const portrait = resolvePortrait(user);
  const hobbies = inferHobbies({ ...user, extra: user.circleHints });
  const shared = myHobbies.filter((item) => hobbies.includes(item));
  const km = distanceKm(mePortrait, portrait);
  const online = isOnline(user.lastSeenAt);
  const circleOverlap = intersectionSize(me.postedCircleIds, user.postedCircleIds);
  const affinity = affinityScore({
    myHobbies,
    theirHobbies: hobbies,
    shared,
    km,
    meLevel: me.level,
    theirLevel: user.level,
    circleOverlap,
    following: user.isFollowing,
    online,
  });

  const raw = {
    nearby: nearbyScore(km, online, shared.length),
    hobby: hobbyScore(shared, myHobbies, hobbies, circleOverlap),
    affinity,
  }[mode];
  const score = clamp(raw, 1, 99);

  return {
    userId: user.id,
    mode,
    score,
    city: portrait.city,
    district: portrait.district,
    hobbies,
    sharedHobbies: shared,
    reason: reason(mode, user.nickname, portrait, km, shared, score),
    distanceKm: km,
    online,
  };
}

function nearbyScore(km: number, online: boolean, sharedCount: number): number {
  let score = 96 - km * 1.15;
  if (km > 80) {
    score -= 18;
  }
  if (online) {
    score += 6;
  }
  score += sharedCount * 2;
  return clamp(Math.round(score), 8, 99);
}

function hobbyScore(shared: string[], mine: string[], theirs: string[], circleOverlap: number): number {
  if (mine.length === 0 && theirs.length === 0) {
    return 36;
  }
  const union = new Set([...mine, ...theirs]).size;
  const jaccard = union === 0 ? 0 : shared.length / union;
  let score = 28 + jaccard * 58 + shared.length * 8 + circleOverlap * 6;
  if (shared.length === 0) {
    score -= 12;
  }
  return clamp(Math.round(score), 12, 99);
}

function affinityScore(input: {
  myHobbies: string[];
  theirHobbies: string[];
  shared: string[];
  km: number;
  meLevel: number;
  theirLevel: number;
  circleOverlap: number;
  following: boolean;
  online: boolean;
}): number {
  const hobby = hobbyScore(input.shared, input.myHobbies, input.theirHobbies, input.circleOverlap);
  const near = 100 - Math.min(input.km, 80) * 0.7;
  const levelScore = clamp(100 - Math.abs(input.meLevel - input.theirLevel) * 3, 40, 100);
  let complement = 0;
  for (const hobbyName of input.myHobbies) {
    const partners = COMPLEMENTARY[hobbyName] ?? [];
    if (partners.some((item) => input.theirHobbies.includes(item))) {
      complement += 8;
    }
  }
  let social = 0;
  if (input.following) {
    social += 10;
  }
  if (input.online) {
    social += 6;
  }
  return clamp(Math.round(hobby * 0.38 + near * 0.22 + levelScore * 0.12 + complement + social), 16, 99);
}

function reason(
  mode: MatchMode,
  nickname: string,
  portrait: MatchPortrait,
  km: number,
  shared: string[],
  score: number,
): string {
  const sharedText = shared.slice(0, 2).join("、");
  if (mode === "nearby") {
    if (km < 1) {
      return sharedText ? `信号几乎叠在一起，你们都爱${sharedText}。` : `信号几乎叠在一起，${nickname} 就在你附近。`;
    }
    if (km < 15) {
      return `${portrait.city}${portrait.district}，直线 ${km.toFixed(1)}km，适合周末偶遇。`;
    }
    return `虽然隔了 ${km.toFixed(0)}km，但 ${portrait.city} 的次元门还开着。`;
  }
  if (mode === "hobby") {
    return sharedText ? `共同爱好：${sharedText}。AI 觉得你们能聊完整晚。` : "爱好还没完全对上，但气质很像可以一起挖坑的人。";
  }
  if (score >= 85) {
    return `次元共振 ${score}%：${sharedText ? `因${sharedText}紧紧咬合` : "气质高度吻合"}。`;
  }
  if (sharedText) {
    return `默契指数 ${score}，先从${sharedText} 开始认识吧。`;
  }
  return `AI 把你们编进同一条平行线，默契指数 ${score}。`;
}

function intersectionSize(a: string[], b: string[]): number {
  const other = new Set(b);
  return a.filter((item) => other.has(item)).length;
}

function hashId(id: string): number {
  let hash = 0;
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

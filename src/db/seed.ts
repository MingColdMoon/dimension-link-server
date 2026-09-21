import type { Pool } from "pg";
import { hashPassword } from "../common/password.js";
import { DEFAULT_CIRCLE_IDS } from "../modules/users/user.types.js";

const DEMO_PASSWORD = "123456";

interface SeedUser {
  id: string;
  nickname: string;
  handle: string;
  bio: string;
  signature: string;
  emoji: string;
  accentIndex: number;
  followers: number;
  following: number;
  level: number;
  badges: string[];
  city: string;
  district: string;
  latitude: number;
  longitude: number;
  hobbies: string[];
  online?: boolean;
}

const USERS: SeedUser[] = [
  {
    id: "u_me",
    nickname: "星野铃",
    handle: "@hoshi_suzu",
    bio: "插画练习生 / 偶尔也写一点短篇同人",
    signature: "今晚也要和星星说晚安。",
    emoji: "🎀",
    accentIndex: 0,
    followers: 1286,
    following: 86,
    level: 18,
    badges: ["绘圈新人王", "樱花祭签到", "次元认证"],
    city: "上海",
    district: "徐汇",
    latitude: 31.1886,
    longitude: 121.437,
    hobbies: ["插画", "同人", "配色", "短篇"],
    online: true,
  },
  {
    id: "u_tsukimi",
    nickname: "月见黑",
    handle: "@tsukimi",
    bio: "同人作者，主推乙女向与群像",
    signature: "黑猫出门时记得带伞。",
    emoji: "🐈‍⬛",
    accentIndex: 1,
    followers: 8420,
    following: 210,
    level: 32,
    badges: ["同人周榜", "连载中"],
    city: "上海",
    district: "静安",
    latitude: 31.2272,
    longitude: 121.453,
    hobbies: ["同人", "乙女", "连载", "黑猫"],
    online: true,
  },
  {
    id: "u_sakurai",
    nickname: "桜井澪",
    handle: "@mio_cos",
    bio: "COSER · 周末出没漫展",
    signature: "假发和心脏都要梳顺。",
    emoji: "🌸",
    accentIndex: 5,
    followers: 22100,
    following: 340,
    level: 41,
    badges: ["漫展常驻", "COS本命"],
    city: "上海",
    district: "黄浦",
    latitude: 31.2317,
    longitude: 121.484,
    hobbies: ["COS", "漫展", "妆造", "约拍"],
    online: true,
  },
  {
    id: "u_nanami",
    nickname: "七海音",
    handle: "@nanami_oto",
    bio: "声优切片收藏家，耳机不离身",
    signature: "今天的电台也有心跳。",
    emoji: "🎧",
    accentIndex: 2,
    followers: 5600,
    following: 401,
    level: 24,
    badges: ["耳语鉴定师"],
    city: "杭州",
    district: "西湖",
    latitude: 30.259,
    longitude: 120.13,
    hobbies: ["声优", "电台", "广播剧", "角色歌"],
  },
  {
    id: "u_kaede",
    nickname: "青叶枫",
    handle: "@kaede_live",
    bio: "游戏主播，夜场排位陪跑",
    signature: "掉分也要笑着打完这把。",
    emoji: "🍁",
    accentIndex: 3,
    followers: 15800,
    following: 99,
    level: 29,
    badges: ["开黑车头", "夜猫"],
    city: "上海",
    district: "浦东",
    latitude: 31.2211,
    longitude: 121.544,
    hobbies: ["游戏", "开黑", "夜猫", "语音"],
    online: true,
  },
  {
    id: "u_tanuki",
    nickname: "狸猫不吃鱼",
    handle: "@tanuki",
    bio: "番剧安利人，评论区常驻",
    signature: "这部真的会哭，先说好。",
    emoji: "🦝",
    accentIndex: 7,
    followers: 9300,
    following: 512,
    level: 27,
    badges: ["安利达人"],
    city: "北京",
    district: "朝阳",
    latitude: 39.921,
    longitude: 116.443,
    hobbies: ["番剧", "安利", "催泪", "新番"],
  },
  {
    id: "u_yukimi",
    nickname: "雪见白",
    handle: "@yukimi_shiro",
    bio: "水彩插画练习生，和星空同频的人优先回关",
    signature: "纸面上的雪不会化。",
    emoji: "❄️",
    accentIndex: 4,
    followers: 2100,
    following: 180,
    level: 16,
    badges: ["绘圈同好", "配色控"],
    city: "上海",
    district: "徐汇",
    latitude: 31.191,
    longitude: 121.441,
    hobbies: ["插画", "水彩", "同人", "配色"],
    online: true,
  },
  {
    id: "u_yoru",
    nickname: "星川夜",
    handle: "@yoru_star",
    bio: "夜场约拍 COSER，假发箱比行李箱还沉",
    signature: "路灯才是我的补光灯。",
    emoji: "🌙",
    accentIndex: 6,
    followers: 7400,
    following: 233,
    level: 28,
    badges: ["夜拍达人", "漫展常驻"],
    city: "上海",
    district: "长宁",
    latitude: 31.2204,
    longitude: 121.424,
    hobbies: ["COS", "夜拍", "漫展", "妆造"],
    online: true,
  },
  {
    id: "u_momo",
    nickname: "桃井糖",
    handle: "@momo_sugar",
    bio: "画甜品也画角色，配色永远站樱花粉",
    signature: "今日糖分超标。",
    emoji: "🍑",
    accentIndex: 0,
    followers: 3600,
    following: 420,
    level: 19,
    badges: ["绘圈日常", "甜品祭"],
    city: "杭州",
    district: "滨江",
    latitude: 30.208,
    longitude: 120.212,
    hobbies: ["绘圈", "甜品", "配色", "插画"],
  },
  {
    id: "u_ritsu",
    nickname: "雾岛律",
    handle: "@ritsu_voice",
    bio: "广播剧后期 / 偶尔也写一点角色小传",
    signature: "气口比台词更诚实。",
    emoji: "🎙️",
    accentIndex: 2,
    followers: 5100,
    following: 166,
    level: 23,
    badges: ["耳语鉴定师", "同人配音"],
    city: "广州",
    district: "天河",
    latitude: 23.135,
    longitude: 113.326,
    hobbies: ["声优", "广播剧", "角色歌", "同人"],
  },
  {
    id: "u_aoi",
    nickname: "南风葵",
    handle: "@aoi_wind",
    bio: "音游和开黑两头跑，语音很温柔",
    signature: "掉分也要笑着打完这把。",
    emoji: "🎐",
    accentIndex: 3,
    followers: 8800,
    following: 140,
    level: 26,
    badges: ["开黑车头", "音游人"],
    city: "成都",
    district: "武侯",
    latitude: 30.642,
    longitude: 104.043,
    hobbies: ["游戏", "开黑", "音游", "语音"],
  },
  {
    id: "u_haku",
    nickname: "白鸟羽",
    handle: "@haku_feather",
    bio: "乙女向同人与番剧考古，评论区安利过载",
    signature: "下一封信会写给你。",
    emoji: "🦢",
    accentIndex: 1,
    followers: 4700,
    following: 390,
    level: 21,
    badges: ["同人周榜", "乙女雷达"],
    city: "上海",
    district: "闵行",
    latitude: 31.1128,
    longitude: 121.381,
    hobbies: ["番剧", "同人", "乙女", "短篇"],
    online: true,
  },
];

const CIRCLES = [
  {
    id: "c_doujin",
    name: "同人创作",
    emoji: "✒️",
    desc: "短篇、长篇、CP 考古，文字与分镜都在这里碰头。",
    memberCount: 12840,
    accentIndex: 1,
    tags: ["乙女", "群像", "无CP", "连载"],
  },
  {
    id: "c_cos",
    name: "COSPLAY",
    emoji: "👗",
    desc: "妆造、道具、片场分享。出片请带标签。",
    memberCount: 20311,
    accentIndex: 0,
    tags: ["妆造", "漫展", "道具", "约拍"],
  },
  {
    id: "c_anime",
    name: "番剧安利",
    emoji: "📺",
    desc: "新番吐槽、神作回访、今晚看什么。",
    memberCount: 35602,
    accentIndex: 6,
    tags: ["新番", "神作", "催泪", "搞笑"],
  },
  {
    id: "c_art",
    name: "绘圈日常",
    emoji: "🎨",
    desc: "速写、厚涂、配色练习，互相摸摸头。",
    memberCount: 18770,
    accentIndex: 2,
    tags: ["速写", "厚涂", "练习", "约稿"],
  },
  {
    id: "c_game",
    name: "游戏开黑",
    emoji: "🎮",
    desc: "缺一补三，语音温柔，别破防。",
    memberCount: 9904,
    accentIndex: 3,
    tags: ["排位", "休闲", "语音", "攻略"],
  },
  {
    id: "c_voice",
    name: "声优电台",
    emoji: "🎙️",
    desc: "广播剧、角色歌、现场切片分享。",
    memberCount: 6408,
    accentIndex: 5,
    tags: ["广播剧", "角色歌", "现场"],
  },
];

function ago(input: { hours?: number; minutes?: number; days?: number }): Date {
  const now = Date.now();
  const ms =
    (input.days ?? 0) * 86_400_000 + (input.hours ?? 0) * 3_600_000 + (input.minutes ?? 0) * 60_000;
  return new Date(now - ms);
}

let cachedPasswordHash: string | undefined;

async function demoHash(): Promise<string> {
  cachedPasswordHash ??= await hashPassword(DEMO_PASSWORD);
  return cachedPasswordHash;
}

async function upsertMatchPortraits(pg: Pool, passwordHash: string): Promise<void> {
  for (const user of USERS) {
    const normalized = user.handle.replace(/^@/, "").toLowerCase();
    const seen = user.online ? new Date() : new Date(Date.now() - 3 * 3600_000);
    await pg.query(
      `INSERT INTO users (
         id, nickname, handle, handle_normalized, bio, signature, emoji,
         accent_index, followers, following, level, badges, password_hash,
         city, district, latitude, longitude, hobbies, last_seen_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO UPDATE SET
         city = EXCLUDED.city,
         district = EXCLUDED.district,
         latitude = EXCLUDED.latitude,
         longitude = EXCLUDED.longitude,
         hobbies = EXCLUDED.hobbies,
         last_seen_at = EXCLUDED.last_seen_at`,
      [
        user.id,
        user.nickname,
        user.handle,
        normalized,
        user.bio,
        user.signature,
        user.emoji,
        user.accentIndex,
        user.followers,
        user.following,
        user.level,
        user.badges,
        passwordHash,
        user.city,
        user.district,
        user.latitude,
        user.longitude,
        user.hobbies,
        seen,
      ],
    );
  }
  const extraMemberships: Array<[string, string]> = [
    ["c_art", "u_yukimi"],
    ["c_cos", "u_yoru"],
    ["c_art", "u_momo"],
    ["c_voice", "u_ritsu"],
    ["c_game", "u_aoi"],
    ["c_doujin", "u_haku"],
  ];
  for (const [circleId, userId] of extraMemberships) {
    await pg.query(
      "INSERT INTO circle_members (circle_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [circleId, userId],
    );
  }
}

/** 导入与 Flutter mock 对齐的联调种子；默认仅在库为空时写入 */
export async function seed(pg: Pool, options?: { force?: boolean }): Promise<void> {
  const passwordHash = await demoHash();
  if (!options?.force) {
    const exists = await pg.query("SELECT 1 FROM users WHERE id = 'u_me'");
    if (exists.rows[0]) {
      await upsertMatchPortraits(pg, passwordHash);
      return;
    }
  }
  const client = await pg.connect();
  try {
    await client.query("BEGIN");

    for (const circle of CIRCLES) {
      await client.query(
        `INSERT INTO circles (id, name, emoji, description, member_count, accent_index, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           emoji = EXCLUDED.emoji,
           description = EXCLUDED.description,
           member_count = EXCLUDED.member_count,
           accent_index = EXCLUDED.accent_index,
           tags = EXCLUDED.tags`,
        [circle.id, circle.name, circle.emoji, circle.desc, circle.memberCount, circle.accentIndex, circle.tags],
      );
    }

    for (const user of USERS) {
      const normalized = user.handle.replace(/^@/, "").toLowerCase();
      await client.query(
        `INSERT INTO users (
           id, nickname, handle, handle_normalized, bio, signature, emoji,
           accent_index, followers, following, level, badges, password_hash,
           city, district, latitude, longitude, hobbies, last_seen_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (id) DO UPDATE SET
           nickname = EXCLUDED.nickname,
           handle = EXCLUDED.handle,
           handle_normalized = EXCLUDED.handle_normalized,
           bio = EXCLUDED.bio,
           signature = EXCLUDED.signature,
           emoji = EXCLUDED.emoji,
           accent_index = EXCLUDED.accent_index,
           followers = EXCLUDED.followers,
           following = EXCLUDED.following,
           level = EXCLUDED.level,
           badges = EXCLUDED.badges,
           password_hash = EXCLUDED.password_hash,
           city = EXCLUDED.city,
           district = EXCLUDED.district,
           latitude = EXCLUDED.latitude,
           longitude = EXCLUDED.longitude,
           hobbies = EXCLUDED.hobbies,
           last_seen_at = EXCLUDED.last_seen_at`,
        [
          user.id,
          user.nickname,
          user.handle,
          normalized,
          user.bio,
          user.signature,
          user.emoji,
          user.accentIndex,
          user.followers,
          user.following,
          user.level,
          user.badges,
          passwordHash,
          user.city,
          user.district,
          user.latitude,
          user.longitude,
          user.hobbies,
          user.online ? new Date() : new Date(Date.now() - 3 * 3600_000),
        ],
      );
    }

    const seedIds = USERS.map((u) => u.id);
    await client.query("DELETE FROM circle_members WHERE user_id = ANY($1::text[])", [seedIds]);
    await client.query("DELETE FROM follows WHERE follower_id = ANY($1::text[]) OR followee_id = ANY($1::text[])", [
      seedIds,
    ]);
    await client.query("DELETE FROM notices WHERE user_id = ANY($1::text[])", [seedIds]);
    await client.query("DELETE FROM messages WHERE sender_id = ANY($1::text[])", [seedIds]);
    await client.query("DELETE FROM conversation_unreads WHERE user_id = ANY($1::text[])", [seedIds]);
    await client.query(
      `DELETE FROM conversations WHERE id IN (
         SELECT conversation_id FROM conversation_members WHERE user_id = ANY($1::text[])
       ) OR user_low = ANY($1::text[]) OR user_high = ANY($1::text[])`,
      [seedIds],
    );
    await client.query("DELETE FROM comments WHERE user_id = ANY($1::text[])", [seedIds]);
    await client.query("DELETE FROM post_likes WHERE user_id = ANY($1::text[])", [seedIds]);
    await client.query("DELETE FROM post_stars WHERE user_id = ANY($1::text[])", [seedIds]);
    await client.query("DELETE FROM posts WHERE author_id = ANY($1::text[])", [seedIds]);

    for (const circleId of DEFAULT_CIRCLE_IDS) {
      await client.query("INSERT INTO circle_members (circle_id, user_id) VALUES ($1, 'u_me')", [circleId]);
    }
    const extraMemberships: Array<[string, string]> = [
      ["c_cos", "u_sakurai"],
      ["c_doujin", "u_tsukimi"],
      ["c_anime", "u_tanuki"],
      ["c_game", "u_kaede"],
      ["c_voice", "u_nanami"],
      ["c_art", "u_yukimi"],
      ["c_cos", "u_yoru"],
      ["c_art", "u_momo"],
      ["c_voice", "u_ritsu"],
      ["c_game", "u_aoi"],
      ["c_doujin", "u_haku"],
    ];
    for (const [circleId, userId] of extraMemberships) {
      await client.query("INSERT INTO circle_members (circle_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING", [
        circleId,
        userId,
      ]);
    }

    await client.query("INSERT INTO follows (follower_id, followee_id) VALUES ('u_me', 'u_sakurai'), ('u_me', 'u_tsukimi')");

    const posts = [
      {
        id: "p1",
        authorId: "u_sakurai",
        content: "漫展返图来啦～假发被风吹成了小龙卷，但眼睛里的星星是真的。谢谢帮我提裙撑的路人妹妹！",
        createdAt: ago({ hours: 2 }),
        mood: "excited",
        circleId: "c_cos",
        imageHue: 330,
        imageTitle: "樱色舞台",
        likedBy: ["u_tsukimi", "u_nanami", "u_me"],
        starredBy: ["u_tanuki"],
      },
      {
        id: "p2",
        authorId: "u_tsukimi",
        content: "新章预告：黑猫穿过雨巷，把一封没有署名的信放在她窗台。今晚更新 3k 字，评论区可以猜结局。",
        createdAt: ago({ hours: 5 }),
        mood: "love",
        circleId: "c_doujin",
        imageHue: 262,
        imageTitle: "雨巷黑猫",
        likedBy: ["u_sakurai", "u_tanuki", "u_nanami"],
        starredBy: ["u_me", "u_kaede"],
      },
      {
        id: "p3",
        authorId: "u_tanuki",
        content: "安利一部会让人安静下来的片子。没有大招，没有反转，只有电车窗外慢慢亮起来的早晨。看完想去便利店买热可可。",
        createdAt: ago({ hours: 9 }),
        mood: "fire",
        circleId: "c_anime",
        imageHue: 28,
        imageTitle: "晨间电车",
        likedBy: ["u_me", "u_nanami"],
        starredBy: ["u_tsukimi"],
      },
      {
        id: "p4",
        authorId: "u_me",
        content: "今日速写：把发卡画成了小行星环。配色还在犹豫，粉紫和薄荷青要打架，大家站哪边？",
        createdAt: ago({ days: 1, hours: 3 }),
        mood: "happy",
        circleId: "c_art",
        imageHue: 312,
        imageTitle: "行星发卡",
        likedBy: ["u_sakurai", "u_kaede"],
        starredBy: [],
      },
      {
        id: "p5",
        authorId: "u_kaede",
        content: "缺一个辅助，今晚十点开黑。要求：别骂队友，可以一起吃夜宵语音。掉分算我的。",
        createdAt: ago({ hours: 3, minutes: 20 }),
        mood: "sleepy",
        circleId: "c_game",
        imageHue: 148,
        imageTitle: "夜场排队",
        likedBy: ["u_tanuki"],
        starredBy: [],
      },
      {
        id: "p6",
        authorId: "u_nanami",
        content: "新角色歌循环了一下午。副歌那句气口像有人轻轻拍了拍肩膀。切片已传圈子，戴耳机听。",
        createdAt: ago({ hours: 7 }),
        mood: "sad",
        circleId: "c_voice",
        imageHue: 200,
        imageTitle: "耳机里的雨",
        likedBy: ["u_me", "u_sakurai", "u_tsukimi", "u_tanuki"],
        starredBy: ["u_me"],
      },
    ];

    for (const post of posts) {
      await client.query(
        `INSERT INTO posts (id, author_id, content, mood, circle_id, image_hue, image_title, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [post.id, post.authorId, post.content, post.mood, post.circleId, post.imageHue, post.imageTitle, post.createdAt],
      );
      for (const userId of post.likedBy) {
        await client.query("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)", [post.id, userId]);
      }
      for (const userId of post.starredBy) {
        await client.query("INSERT INTO post_stars (post_id, user_id) VALUES ($1, $2)", [post.id, userId]);
      }
    }

    const comments = [
      { id: "cmt1", postId: "p1", userId: "u_tsukimi", content: "裙撑绝了，下一场还出这个吗？", createdAt: ago({ hours: 1, minutes: 40 }) },
      { id: "cmt2", postId: "p1", userId: "u_me", content: "星星眼睛好会！求妆造分享～", createdAt: ago({ hours: 1 }) },
      { id: "cmt3", postId: "p2", userId: "u_tanuki", content: "我赌是青梅竹马！", createdAt: ago({ hours: 4 }) },
      { id: "cmt4", postId: "p4", userId: "u_kaede", content: "薄荷青！和你头像超配。", createdAt: ago({ days: 1, hours: 1 }) },
      { id: "cmt5", postId: "p5", userId: "u_me", content: "我辅助很菜但很温柔，求带！", createdAt: ago({ hours: 3 }) },
    ];
    for (const comment of comments) {
      await client.query(
        `INSERT INTO comments (id, post_id, user_id, content, created_at) VALUES ($1,$2,$3,$4,$5)`,
        [comment.id, comment.postId, comment.userId, comment.content, comment.createdAt],
      );
    }

    const convs = [
      { id: "cv1", a: "u_me", b: "u_sakurai", unreadMe: 1, unreadPeer: 0 },
      { id: "cv2", a: "u_me", b: "u_tsukimi", unreadMe: 0, unreadPeer: 0 },
      { id: "cv3", a: "u_kaede", b: "u_me", unreadMe: 2, unreadPeer: 0 },
    ];
    for (const conv of convs) {
      const [low, high] = conv.a < conv.b ? [conv.a, conv.b] : [conv.b, conv.a];
      await client.query(
        "INSERT INTO conversations (id, user_low, user_high, kind, owner_id) VALUES ($1,$2,$3,'direct',$4)",
        [conv.id, low, high, conv.a],
      );
      await client.query(
        "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1,$2), ($1,$3)",
        [conv.id, conv.a, conv.b],
      );
      await client.query("INSERT INTO conversation_unreads (conversation_id, user_id, unread) VALUES ($1,$2,$3), ($1,$4,$5)", [
        conv.id,
        "u_me",
        conv.unreadMe,
        conv.a === "u_me" ? conv.b : conv.a,
        conv.unreadPeer,
      ]);
    }

    await client.query(
      "INSERT INTO conversations (id, kind, title, owner_id) VALUES ($1,'group',$2,$3)",
      ["cv_group", "漫展小队", "u_me"],
    );
    for (const memberId of ["u_me", "u_sakurai", "u_tsukimi"]) {
      await client.query("INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1,$2,$3)", [
        "cv_group",
        memberId,
        memberId === "u_me" ? "owner" : memberId === "u_sakurai" ? "admin" : "member",
      ]);
      await client.query("INSERT INTO conversation_unreads (conversation_id, user_id, unread) VALUES ($1,$2,0)", [
        "cv_group",
        memberId,
      ]);
    }

    const messages = [
      { id: "m1", convId: "cv1", senderId: "u_sakurai", text: "铃铃！下周漫展你来吗，想和你合影～", createdAt: ago({ hours: 6 }) },
      { id: "m2", convId: "cv1", senderId: "u_me", text: "来！我带新画的小立牌。", createdAt: ago({ hours: 5, minutes: 50 }) },
      { id: "m3", convId: "cv1", senderId: "u_sakurai", text: "太好了，我在西区 Cos 舞台附近等你。", createdAt: ago({ minutes: 40 }) },
      { id: "m4", convId: "cv2", senderId: "u_tsukimi", text: "你上次那张发卡速写，我写进新章里当信物了。", createdAt: ago({ days: 1, hours: 2 }) },
      { id: "m5", convId: "cv2", senderId: "u_me", text: "哇真的吗，我要去连夜补番外！", createdAt: ago({ days: 1, hours: 1 }) },
      { id: "m6", convId: "cv3", senderId: "u_kaede", text: "辅助位还空着哦。", createdAt: ago({ hours: 2 }) },
      { id: "m7", convId: "cv3", senderId: "u_kaede", text: "语音房间开好了，密码是 sakura。", createdAt: ago({ minutes: 25 }) },
      { id: "mg1", convId: "cv_group", senderId: "u_sakurai", text: "群建好啦，返图都丢这里～", createdAt: ago({ hours: 3 }) },
    ];
    for (const message of messages) {
      await client.query(
        `INSERT INTO messages (id, conversation_id, sender_id, text, created_at) VALUES ($1,$2,$3,$4,$5)`,
        [message.id, message.convId, message.senderId, message.text, message.createdAt],
      );
    }

    const notices = [
      {
        id: "n1",
        title: "樱花祭签到成功",
        body: "连续打卡 3 天，获得徽章「樱花祭签到」。",
        createdAt: ago({ hours: 8 }),
        kind: "badge",
      },
      {
        id: "n2",
        title: "月见黑 收藏了你的动态",
        body: "「行星发卡」被收入对方的星标匣。",
        createdAt: ago({ hours: 12 }),
        kind: "star",
      },
      {
        id: "n3",
        title: "圈子邀请",
        body: "绘圈日常邀请你参加「一周配色挑战」。",
        createdAt: ago({ days: 1 }),
        kind: "circle",
      },
    ];
    for (const notice of notices) {
      await client.query(
        `INSERT INTO notices (id, user_id, title, body, kind, created_at) VALUES ($1,'u_me',$2,$3,$4,$5)`,
        [notice.id, notice.title, notice.body, notice.kind, notice.createdAt],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

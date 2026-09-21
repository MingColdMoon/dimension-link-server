import { toIso } from "../../common/http.js";
import type { CircleItem, CircleSummary, CommentItem, PostCard, UserPublic } from "../../types.js";
import type { UserRow } from "./user.types.js";

export function toUserPublic(row: UserRow, isFollowing = false): UserPublic {
  return {
    id: row.id,
    nickname: row.nickname,
    handle: row.handle,
    bio: row.bio,
    signature: row.signature,
    emoji: row.emoji,
    accentIndex: row.accent_index,
    followers: row.followers,
    following: row.following,
    level: row.level,
    badges: row.badges ?? [],
    isFollowing,
    city: row.city ?? "",
    district: row.district ?? "",
    hobbies: row.hobbies ?? [],
  };
}

export function toCircleItem(row: {
  id: string;
  name: string;
  emoji: string;
  description: string;
  member_count: number;
  accent_index: number;
  tags: string[];
  joined: boolean;
}): CircleItem {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji,
    desc: row.description,
    memberCount: row.member_count,
    accentIndex: row.accent_index,
    tags: row.tags ?? [],
    joined: row.joined,
  };
}

export function toCircleSummary(row: { id: string; name: string; emoji: string }): CircleSummary {
  return { id: row.id, name: row.name, emoji: row.emoji };
}

export function toPostCard(input: {
  id: string;
  content: string;
  created_at: Date | string;
  mood: string;
  image_hue: number;
  image_title: string;
  like_count: number;
  star_count: number;
  comment_count: number;
  liked: boolean;
  starred: boolean;
  author: UserPublic;
  circle: CircleSummary;
  comments?: CommentItem[];
}): PostCard {
  return {
    id: input.id,
    author: input.author,
    content: input.content,
    createdAt: toIso(input.created_at),
    mood: input.mood,
    circle: input.circle,
    imageHue: input.image_hue,
    imageTitle: input.image_title,
    likeCount: Number(input.like_count),
    starCount: Number(input.star_count),
    commentCount: Number(input.comment_count),
    liked: input.liked,
    starred: input.starred,
    comments: input.comments,
  };
}

import type { DefaultContext, DefaultState, ParameterizedContext } from "koa";
import type { Pool } from "pg";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import type { AppConfig } from "./config.js";

export interface AuthUser {
  id: string;
  accessJti: string;
}

export interface AppState extends DefaultState {
  requestId: string;
  user?: AuthUser;
}

export type AppContext = ParameterizedContext<AppState, DefaultContext>;

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  pg: Pool;
  redis: Redis;
}

export interface UserPublic {
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
  isFollowing: boolean;
  joinedCircleIds?: string[];
}

export interface CircleSummary {
  id: string;
  name: string;
  emoji: string;
}

export interface CircleItem {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  memberCount: number;
  accentIndex: number;
  tags: string[];
  joined: boolean;
}

export interface PostCard {
  id: string;
  author: UserPublic;
  content: string;
  createdAt: string;
  mood: string;
  circle: CircleSummary;
  imageHue: number;
  imageTitle: string;
  likeCount: number;
  starCount: number;
  commentCount: number;
  liked: boolean;
  starred: boolean;
  comments?: CommentItem[];
}

export interface CommentItem {
  id: string;
  user: UserPublic;
  content: string;
  createdAt: string;
}

export interface ChatMessageItem {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  kind: "direct" | "group";
  title: string | null;
  ownerId: string | null;
  members: UserPublic[];
  peer: UserPublic;
  unread: number;
  lastMessage: ChatMessageItem | null;
}

export interface NoticeItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  kind: string;
}

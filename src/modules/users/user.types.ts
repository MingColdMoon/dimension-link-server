export const MOODS = ["happy", "excited", "sleepy", "love", "sad", "fire"] as const;
export type Mood = (typeof MOODS)[number];

export const DEFAULT_CIRCLE_IDS = ["c_doujin", "c_cos", "c_anime"] as const;

export interface UserRow {
  id: string;
  nickname: string;
  handle: string;
  handle_normalized: string;
  bio: string;
  signature: string;
  emoji: string;
  accent_index: number;
  followers: number;
  following: number;
  level: number;
  badges: string[];
  city?: string;
  district?: string;
  hobbies?: string[];
  latitude?: number | string | null;
  longitude?: number | string | null;
  last_seen_at?: Date | null;
  password_hash?: string;
  created_at: Date;
  updated_at?: Date;
}

export const USER_PUBLIC_COLUMNS = `
  id, nickname, handle, handle_normalized, bio, signature, emoji,
  accent_index, followers, following, level, badges, created_at,
  city, district, hobbies, latitude, longitude, last_seen_at
`;

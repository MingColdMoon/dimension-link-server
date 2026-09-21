import type { UserPublic } from "../../types.js";

export type MatchMode = "nearby" | "hobby" | "affinity";

export interface MatchPortrait {
  city: string;
  district: string;
  latitude: number;
  longitude: number;
}

export interface MatchScoreInput {
  id: string;
  nickname: string;
  bio: string;
  signature: string;
  badges: string[];
  hobbies: string[];
  city: string;
  district: string;
  latitude: number | null;
  longitude: number | null;
  level: number;
  isFollowing: boolean;
  lastSeenAt: Date | string | null;
  circleHints: string[];
  postedCircleIds: string[];
}

export interface MatchCandidate {
  userId: string;
  mode: MatchMode;
  score: number;
  city: string;
  district: string;
  hobbies: string[];
  sharedHobbies: string[];
  reason: string;
  distanceKm: number;
  online: boolean;
}

export interface MatchCandidateView extends Omit<MatchCandidate, "userId"> {
  user: UserPublic;
}

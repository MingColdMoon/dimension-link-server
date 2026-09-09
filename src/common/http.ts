import type { z } from "zod";
import { AppError, ErrorCode } from "./errors.js";

export interface ApiSuccess<T> {
  code: 0;
  message: "ok";
  data: T;
}

export interface PageData<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function ok<T>(data: T): ApiSuccess<T> {
  return { code: 0, message: "ok", data };
}

export function parseBody<S extends z.ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "参数错误";
    throw new AppError(400, ErrorCode.EMPTY_CONTENT, message);
  }
  return result.data;
}

export function parseLimit(raw: unknown, fallback = 20, max = 50): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === "") {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    return fallback;
  }
  return Math.min(num, max);
}

export function firstQuery(raw: unknown): string | undefined {
  if (Array.isArray(raw)) {
    return raw[0];
  }
  return typeof raw === "string" ? raw : undefined;
}

export function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

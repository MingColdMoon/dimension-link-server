import { randomUUID } from "node:crypto";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "");
}

export function displayHandle(normalized: string): string {
  return `@${normalized}`;
}

export function pairUsers(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

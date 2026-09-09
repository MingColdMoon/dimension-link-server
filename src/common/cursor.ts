export interface CursorPos {
  createdAt: Date;
  id: string;
}

/** 将时间 + id 编码为 cursor，避免直接暴露内部排序键 */
export function encodeCursor(createdAt: Date | string, id: string): string {
  const iso = createdAt instanceof Date ? createdAt.toISOString() : new Date(createdAt).toISOString();
  return Buffer.from(JSON.stringify({ t: iso, i: id }), "utf8").toString("base64url");
}

export function decodeCursor(raw?: string): CursorPos | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { t?: string; i?: string };
    if (!parsed.t || !parsed.i) {
      return undefined;
    }
    const createdAt = new Date(parsed.t);
    if (Number.isNaN(createdAt.getTime())) {
      return undefined;
    }
    return { createdAt, id: parsed.i };
  } catch {
    return undefined;
  }
}

export function paginate<T>(rows: T[], limit: number, cursorOf: (item: T) => { createdAt: Date | string; id: string }) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(cursorOf(last).createdAt, cursorOf(last).id) : null,
  };
}

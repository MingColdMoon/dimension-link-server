import type { Pool } from "pg";
import { decodeCursor, paginate } from "../../common/cursor.js";
import { toIso } from "../../common/http.js";
import type { NoticeItem } from "../../types.js";

export class NoticeService {
  constructor(private readonly pg: Pool) {}

  async list(
    viewerId: string,
    query: { cursor?: string; limit: number },
  ): Promise<{ items: NoticeItem[]; nextCursor: string | null; hasMore: boolean }> {
    const cursor = decodeCursor(query.cursor);
    const params: unknown[] = [viewerId];
    let where = "WHERE user_id = $1";
    if (cursor) {
      params.push(cursor.createdAt, cursor.id);
      where += ` AND (created_at, id) < ($${params.length - 1}, $${params.length})`;
    }
    params.push(query.limit + 1);
    const result = await this.pg.query<{ id: string; title: string; body: string; kind: string; created_at: Date }>(
      `SELECT id, title, body, kind, created_at FROM notices ${where}
       ORDER BY created_at DESC, id DESC LIMIT $${params.length}`,
      params,
    );
    const items = result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      kind: row.kind,
      createdAt: toIso(row.created_at),
    }));
    return paginate(items, query.limit, (item) => ({ createdAt: item.createdAt, id: item.id }));
  }
}

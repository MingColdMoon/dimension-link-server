import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Pool } from "pg";
import { loadConfig } from "../config.js";
import { logger } from "../logger.js";
import { createPostgres } from "./postgres.js";

function resolveSqlDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../sql");
}

/** 按文件名顺序执行尚未应用的 SQL 迁移 */
export async function migrate(pool: Pool, sqlDir = resolveSqlDir()): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(sqlDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const applied = await pool.query<{ filename: string }>("SELECT filename FROM schema_migrations");
  const appliedSet = new Set(applied.rows.map((row) => row.filename));

  for (const filename of files) {
    if (appliedSet.has(filename)) {
      continue;
    }
    const sql = await readFile(path.join(sqlDir, filename), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      logger.info({ filename }, "已应用数据库迁移");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

async function runCli(): Promise<void> {
  const config = loadConfig();
  const pool = createPostgres(config);
  try {
    await migrate(pool);
  } finally {
    await pool.end();
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  runCli().catch((err) => {
    logger.error({ err }, "数据库迁移失败");
    process.exit(1);
  });
}

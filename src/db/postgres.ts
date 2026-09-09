import pg from "pg";
import type { AppConfig } from "../config.js";

const { Pool } = pg;

export function createPostgres(config: AppConfig): pg.Pool {
  return new Pool({
    host: config.POSTGRES_HOST,
    port: config.POSTGRES_PORT,
    user: config.POSTGRES_USER,
    password: config.POSTGRES_PASSWORD,
    database: config.POSTGRES_DB,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export async function pingPostgres(pool: pg.Pool): Promise<void> {
  await pool.query("SELECT 1");
}

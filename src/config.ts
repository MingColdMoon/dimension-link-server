import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  POSTGRES_HOST: z.string().default("127.0.0.1"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_USER: z.string().default("dimension"),
  POSTGRES_PASSWORD: z.string().default("dimension"),
  POSTGRES_DB: z.string().default("dimension_link"),
  REDIS_HOST: z.string().default("127.0.0.1"),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().optional().default(""),
  JWT_SECRET: z.string().min(8).default("change-me-in-production"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("2h"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(7200),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(30 * 24 * 3600),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`环境变量配置无效: ${details}`);
  }
  return parsed.data;
}

export const config = loadConfig();

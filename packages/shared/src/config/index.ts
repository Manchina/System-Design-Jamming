import { z } from "zod";
import dotenv from "dotenv";

// Load local .env if present
dotenv.config();

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  
  // Storage & Database
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/system_design"),
  
  // Redis primary & shards
  REDIS_PRIMARY_URL: z.string().default("redis://localhost:6379"),
  REDIS_SHARD_1_URL: z.string().default("redis://localhost:6380"),
  REDIS_SHARD_2_URL: z.string().default("redis://localhost:6381"),
  REDIS_SHARD_3_URL: z.string().default("redis://localhost:6382"),
  
  // MinIO S3
  MINIO_ENDPOINT: z.string().default("localhost"),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_ACCESS_KEY: z.string().default("minioadmin"),
  MINIO_SECRET_KEY: z.string().default("minioadmin"),
  MINIO_BUCKET_NAME: z.string().default("media-uploads"),
});

export type AppConfig = z.infer<typeof configSchema>;

let cachedConfig: AppConfig | null = null;

export function loadConfig(envOverrides?: Partial<Record<string, string>>): AppConfig {
  if (cachedConfig && !envOverrides) {
    return cachedConfig;
  }

  const rawEnv = {
    ...process.env,
    ...envOverrides,
  };

  const parsed = configSchema.safeParse(rawEnv);

  if (!parsed.success) {
    console.error("Configuration validation failed:", parsed.error.format());
    throw new Error(`Invalid application configuration: ${parsed.error.message}`);
  }

  if (!envOverrides) {
    cachedConfig = parsed.data;
  }

  return parsed.data;
}

export const config = loadConfig();

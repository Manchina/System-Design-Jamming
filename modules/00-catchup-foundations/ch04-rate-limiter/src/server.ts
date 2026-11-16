import Fastify from "fastify";
import { Redis } from "ioredis";
import rateLimiterPlugin from "./plugin.js";
import { loadConfig, logger } from "@system-design/shared";

const config = loadConfig();

export async function buildServer(options?: {
  redisUrl?: string;
  limit?: number;
  windowMs?: number;
  algorithm?: "sliding-window" | "token-bucket";
}) {
  const app = Fastify({
    logger: false, // Pino structured logger is used via @system-design/shared
  });

  const redis = new Redis(options?.redisUrl ?? config.REDIS_PRIMARY_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  await redis.connect().catch((err) => {
    logger.warn(`Redis connection error (running in local fallback if mocked): ${err.message}`);
  });

  // Register rate limiter plugin
  await app.register(rateLimiterPlugin, {
    redis,
    algorithm: options?.algorithm ?? "sliding-window",
    limit: options?.limit ?? 50, // 50 requests per 5-second window for demonstration
    windowMs: options?.windowMs ?? 5000,
  });

  // Health check endpoint (bypasses rate limit)
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Standard rate-limited ping route
  app.get("/api/ping", async () => {
    return { message: "pong", timestamp: Date.now() };
  });

  // Concurrency test endpoint
  app.get("/api/burst-test", async () => {
    return { success: true, processedAt: Date.now() };
  });

  return { app, redis };
}

// Direct execution entrypoint
if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  const port = Number(process.env.PORT) || 3004;
  const { app } = await buildServer();

  app.listen({ port, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      logger.error(err, "Failed to start server");
      process.exit(1);
    }
    logger.info(`Rate Limiter showcase server listening on ${address}`);
    logger.info(`Run 'npm run bench:rate-limiter' to execute the autocannon race-condition verification.`);
  });
}

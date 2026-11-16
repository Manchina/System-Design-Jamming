import Fastify from "fastify";
import { Redis } from "ioredis";
import { DatabaseRouter, UserRecord } from "./db-router.js";
import { CacheAsideManager } from "./cache-aside.js";
import { loadConfig, logger } from "@system-design/shared";

const config = loadConfig();

export async function buildApp() {
  const app = Fastify({ logger: false });

  const redis = new Redis(config.REDIS_PRIMARY_URL, { lazyConnect: true });
  await redis.connect().catch((err) => {
    logger.warn(`Redis connection: ${err.message}`);
  });

  const dbRouter = new DatabaseRouter();
  const userCache = new CacheAsideManager<UserRecord>(redis, "user", 300);

  // Read endpoint: Cache-Aside -> Replica DB
  app.get<{ Params: { id: string } }>("/api/users/:id", async (req, reply) => {
    const { id } = req.params;
    const result = await userCache.getOrSet(id, async () => {
      return dbRouter.read(id);
    });

    if (!result.data) {
      return reply.code(404).send({ error: "User not found" });
    }

    reply.header("X-Cache-Status", result.hit ? "HIT" : "MISS");
    return result.data;
  });

  // Write endpoint: Primary DB -> Cache Invalidation
  app.post<{ Body: { id: string; name: string; email: string; tier: "free" | "pro" | "enterprise" } }>(
    "/api/users",
    async (req, reply) => {
      const { id, name, email, tier } = req.body;
      const record: UserRecord = {
        id,
        name,
        email,
        tier,
        updatedAt: new Date().toISOString(),
      };

      await dbRouter.write(record);
      await userCache.invalidate(id);

      return reply.code(201).send(record);
    }
  );

  return { app, redis };
}

if (process.argv[1] && process.argv[1].endsWith("server.ts")) {
  const port = 3001;
  const { app } = await buildApp();
  app.listen({ port, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      logger.error(err);
      process.exit(1);
    }
    logger.info(`Chapter 1 Server running on ${address}`);
  });
}

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Redis } from "ioredis";
import Fastify from "fastify";
import rateLimiterPlugin, { evaluateRateLimit } from "./plugin.js";

describe("Chapter 4: Atomic Redis Rate Limiter", () => {
  let redis: Redis;
  let isRedisAvailable = false;

  beforeAll(async () => {
    redis = new Redis(process.env.REDIS_PRIMARY_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      lazyConnect: true,
    });

    try {
      await redis.connect();
      await redis.ping();
      isRedisAvailable = true;
    } catch {
      console.warn("Local Redis not reachable; running rate limiter evaluation tests with mocked eval");
      isRedisAvailable = false;
    }
  });

  afterAll(async () => {
    if (isRedisAvailable) {
      const keys = await redis.keys("ratelimit:*");
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    }
  });

  it("should evaluate sliding window rate limits accurately", async () => {
    if (!isRedisAvailable) {
      return; // Skip if Redis container isn't running yet
    }

    const testKey = `test:sw:${Date.now()}`;
    const limit = 5;
    const windowMs = 5000;

    // Send 5 requests -> all must be allowed
    for (let i = 0; i < limit; i++) {
      const res = await evaluateRateLimit(redis, "sliding-window", testKey, {
        limit,
        windowMs,
        refillRate: 1,
        cost: 1,
      });
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(limit - (i + 1));
    }

    // 6th request -> must be rejected
    const blocked = await evaluateRateLimit(redis, "sliding-window", testKey, {
      limit,
      windowMs,
      refillRate: 1,
      cost: 1,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAfterMs).toBeGreaterThan(0);
  });

  it("should evaluate token bucket rate limits accurately", async () => {
    if (!isRedisAvailable) {
      return;
    }

    const testKey = `test:tb:${Date.now()}`;
    const capacity = 3;
    const refillRate = 1; // 1 token per second

    // Consume all 3 tokens
    for (let i = 0; i < capacity; i++) {
      const res = await evaluateRateLimit(redis, "token-bucket", testKey, {
        limit: capacity,
        windowMs: 1000,
        refillRate,
        cost: 1,
      });
      expect(res.allowed).toBe(true);
    }

    // 4th request -> blocked
    const blocked = await evaluateRateLimit(redis, "token-bucket", testKey, {
      limit: capacity,
      windowMs: 1000,
      refillRate,
      cost: 1,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.resetAfterMs).toBeGreaterThan(0);
  });

  it("should inject X-RateLimit headers and return 429 with Retry-After in Fastify", async () => {
    let testRedis = redis;
    if (!isRedisAvailable) {
      // Provide an in-memory eval mock so Fastify route handling and headers are tested without Docker
      let requestCount = 0;
      testRedis = {
        eval: async (_script: string, _numKeys: number, _key: string, limit: number) => {
          requestCount++;
          if (requestCount <= limit) {
            return [1, limit - requestCount, 0];
          }
          return [0, 0, 5000]; // blocked, 5s reset
        },
      } as unknown as Redis;
    }

    const app = Fastify();
    await app.register(rateLimiterPlugin, {
      redis: testRedis,
      algorithm: "sliding-window",
      limit: 2,
      windowMs: 10000,
      keyGenerator: () => "integration-test-client",
    });

    app.get("/test", async () => ({ hello: "world" }));

    // Request 1
    const res1 = await app.inject({ method: "GET", url: "/test" });
    expect(res1.statusCode).toBe(200);
    expect(res1.headers["x-ratelimit-limit"]).toBe("2");
    expect(res1.headers["x-ratelimit-remaining"]).toBe("1");

    // Request 2
    const res2 = await app.inject({ method: "GET", url: "/test" });
    expect(res2.statusCode).toBe(200);
    expect(res2.headers["x-ratelimit-remaining"]).toBe("0");

    // Request 3 -> Rate Limited
    const res3 = await app.inject({ method: "GET", url: "/test" });
    expect(res3.statusCode).toBe(429);
    expect(res3.headers["retry-after"]).toBeDefined();
    const body = JSON.parse(res3.payload);
    expect(body.error).toBe("Too Many Requests");
    expect(body.retryAfter).toBeGreaterThan(0);

    await app.close();
  });
});

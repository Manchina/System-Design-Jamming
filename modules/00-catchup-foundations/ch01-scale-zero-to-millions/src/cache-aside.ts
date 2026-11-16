import { Redis } from "ioredis";
import { logger } from "@system-design/shared";

export class CacheAsideManager<T> {
  constructor(
    private redis: Redis,
    private prefix: string,
    private defaultTtlSeconds = 60
  ) {}

  /**
   * Reads from cache. If miss, invokes loader, populates cache with TTL, and returns data.
   */
  public async getOrSet(
    key: string,
    loader: () => Promise<T | null>,
    ttlSeconds = this.defaultTtlSeconds
  ): Promise<{ data: T | null; hit: boolean }> {
    const cacheKey = `${this.prefix}:${key}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached !== null) {
        logger.debug({ cacheKey }, "[Cache-Aside] CACHE HIT");
        return { data: JSON.parse(cached) as T, hit: true };
      }
    } catch (err) {
      logger.warn({ err }, "[Cache-Aside] Redis read failure, falling back to source");
    }

    logger.debug({ cacheKey }, "[Cache-Aside] CACHE MISS -> Fetching from persistent store");
    const data = await loader();

    if (data !== null) {
      try {
        await this.redis.set(cacheKey, JSON.stringify(data), "EX", ttlSeconds);
      } catch (err) {
        logger.warn({ err }, "[Cache-Aside] Redis write failure");
      }
    }

    return { data, hit: false };
  }

  /**
   * Invalidates cache key immediately on write / mutation.
   */
  public async invalidate(key: string): Promise<void> {
    const cacheKey = `${this.prefix}:${key}`;
    logger.info({ cacheKey }, "[Cache-Aside] Invalidating cache key");
    try {
      await this.redis.del(cacheKey);
    } catch (err) {
      logger.warn({ err }, "[Cache-Aside] Redis invalidation error");
    }
  }
}

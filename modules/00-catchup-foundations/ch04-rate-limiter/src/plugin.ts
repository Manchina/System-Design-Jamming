import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { Redis } from "ioredis";
import crypto from "node:crypto";

export type RateLimiterAlgorithm = "sliding-window" | "token-bucket";

export interface RateLimiterOptions {
  redis: Redis;
  algorithm?: RateLimiterAlgorithm;
  limit?: number; // max requests for sliding window OR capacity for token bucket
  windowMs?: number; // window size in ms for sliding window (default: 60,000ms = 1 min)
  refillRate?: number; // tokens/second for token-bucket (default: 10)
  cost?: number; // tokens/request (default: 1)
  keyGenerator?: (req: FastifyRequest) => string;
  skip?: (req: FastifyRequest) => boolean;
  addHeaders?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAfterMs: number;
}

// Inlined Lua scripts for zero-latency execution and zero-dependency packaging
export const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now_ms = tonumber(ARGV[4])

local data = redis.call("HMGET", key, "tokens", "last_refreshed_ms")
local current_tokens = tonumber(data[1])
local last_refreshed_ms = tonumber(data[2])

if current_tokens == nil or last_refreshed_ms == nil then
  current_tokens = capacity
  last_refreshed_ms = now_ms
else
  local elapsed_ms = math.max(0, now_ms - last_refreshed_ms)
  local elapsed_sec = elapsed_ms / 1000.0
  local refilled = elapsed_sec * refill_rate
  current_tokens = math.min(capacity, current_tokens + refilled)
  last_refreshed_ms = now_ms
end

local allowed = 0
local remaining = 0
local reset_after_ms = 0

if current_tokens >= cost then
  allowed = 1
  current_tokens = current_tokens - cost
  remaining = math.floor(current_tokens)
  reset_after_ms = 0
else
  allowed = 0
  remaining = math.floor(current_tokens)
  local deficit = cost - current_tokens
  reset_after_ms = math.ceil((deficit / refill_rate) * 1000)
end

redis.call("HMSET", key, "tokens", tostring(current_tokens), "last_refreshed_ms", tostring(last_refreshed_ms))
local ttl_seconds = math.max(1, math.ceil((capacity / refill_rate) * 2))
redis.call("EXPIRE", key, ttl_seconds)

return { allowed, remaining, reset_after_ms }
`;

export const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_size_ms = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local request_id = ARGV[4]

local window_start_ms = now_ms - window_size_ms
redis.call("ZREMRANGEBYSCORE", key, "-inf", window_start_ms)

local current_count = redis.call("ZCARD", key)
local allowed = 0
local remaining = 0
local reset_after_ms = 0

if current_count < limit then
  redis.call("ZADD", key, now_ms, request_id)
  redis.call("PEXPIRE", key, window_size_ms)
  allowed = 1
  remaining = limit - (current_count + 1)
  reset_after_ms = 0
else
  allowed = 0
  remaining = 0
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  if #oldest > 0 then
    local oldest_timestamp = tonumber(oldest[2])
    reset_after_ms = math.max(1, (oldest_timestamp + window_size_ms) - now_ms)
  else
    reset_after_ms = window_size_ms
  end
end

return { allowed, remaining, reset_after_ms }
`;

export async function evaluateRateLimit(
  redis: Redis,
  algorithm: RateLimiterAlgorithm,
  key: string,
  options: {
    limit: number;
    windowMs: number;
    refillRate: number;
    cost: number;
  }
): Promise<RateLimitResult> {
  const nowMs = Date.now();

  let res: [number, number, number];

  if (algorithm === "token-bucket") {
    const redisKey = `ratelimit:tb:${key}`;
    const result = (await redis.eval(
      TOKEN_BUCKET_LUA,
      1,
      redisKey,
      options.limit,
      options.refillRate,
      options.cost,
      nowMs
    )) as [number, number, number];
    res = result;
  } else {
    const redisKey = `ratelimit:sw:${key}`;
    const requestId = `${nowMs}:${crypto.randomUUID()}`;
    const result = (await redis.eval(
      SLIDING_WINDOW_LUA,
      1,
      redisKey,
      options.limit,
      options.windowMs,
      nowMs,
      requestId
    )) as [number, number, number];
    res = result;
  }

  return {
    allowed: res[0] === 1,
    remaining: res[1],
    resetAfterMs: res[2],
  };
}

const fastifyRateLimiter: FastifyPluginAsync<RateLimiterOptions> = async (fastify: FastifyInstance, opts) => {
  const redis = opts.redis;
  if (!redis) {
    throw new Error("fastify-rate-limiter requires an ioredis instance");
  }

  const algorithm = opts.algorithm ?? "sliding-window";
  const limit = opts.limit ?? 100;
  const windowMs = opts.windowMs ?? 60000;
  const refillRate = opts.refillRate ?? 10;
  const cost = opts.cost ?? 1;
  const addHeaders = opts.addHeaders ?? true;

  const defaultKeyGen = (req: FastifyRequest) => {
    const apiKey = req.headers["x-api-key"];
    if (typeof apiKey === "string" && apiKey.length > 0) {
      return `api-key:${apiKey}`;
    }
    return `ip:${req.ip}`;
  };

  const keyGen = opts.keyGenerator ?? defaultKeyGen;

  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    if (opts.skip && opts.skip(request)) {
      return;
    }

    const clientKey = keyGen(request);
    const now = Date.now();

    const result = await evaluateRateLimit(redis, algorithm, clientKey, {
      limit,
      windowMs,
      refillRate,
      cost,
    });

    if (addHeaders) {
      reply.header("X-RateLimit-Limit", limit);
      reply.header("X-RateLimit-Remaining", Math.max(0, result.remaining));
      const resetEpochSeconds = Math.ceil((now + (result.resetAfterMs || windowMs)) / 1000);
      reply.header("X-RateLimit-Reset", resetEpochSeconds);
    }

    if (!result.allowed) {
      const retryAfterSeconds = Math.max(1, Math.ceil(result.resetAfterMs / 1000));
      reply.header("Retry-After", retryAfterSeconds);

      return reply.code(429).send({
        statusCode: 429,
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${retryAfterSeconds} seconds.`,
        retryAfter: retryAfterSeconds,
      });
    }
  });
};

export default fp(fastifyRateLimiter, {
  fastify: ">=4.0.0",
  name: "@system-design/ch04-rate-limiter",
});

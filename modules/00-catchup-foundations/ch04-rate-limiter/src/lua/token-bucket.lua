-- Token Bucket Algorithm (Redis Lua)
-- KEYS[1]: Rate limit hash key (e.g. "ratelimit:tb:client-123")
-- ARGV[1]: Bucket capacity (number)
-- ARGV[2]: Refill rate per second (number)
-- ARGV[3]: Cost of current request (number)
-- ARGV[4]: Current timestamp in milliseconds (number)

local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local now_ms = tonumber(ARGV[4])

-- Retrieve current tokens and last refreshed timestamp
local data = redis.call("HMGET", key, "tokens", "last_refreshed_ms")
local current_tokens = tonumber(data[1])
local last_refreshed_ms = tonumber(data[2])

if current_tokens == nil or last_refreshed_ms == nil then
  -- First request: initialize bucket to full capacity
  current_tokens = capacity
  last_refreshed_ms = now_ms
else
  -- Calculate tokens refilled based on elapsed time
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

-- Save updated state
redis.call("HMSET", key, "tokens", tostring(current_tokens), "last_refreshed_ms", tostring(last_refreshed_ms))

-- Expire key after bucket has had time to fully refill twice (cleanup idle keys)
local ttl_seconds = math.max(1, math.ceil((capacity / refill_rate) * 2))
redis.call("EXPIRE", key, ttl_seconds)

return { allowed, remaining, reset_after_ms }

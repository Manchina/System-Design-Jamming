-- Sliding Window Counter / Log Algorithm (Redis Lua)
-- KEYS[1]: Rate limit sorted set key (e.g. "ratelimit:sw:client-123")
-- ARGV[1]: Maximum allowed requests in window (number)
-- ARGV[2]: Window size in milliseconds (number)
-- ARGV[3]: Current timestamp in milliseconds (number)
-- ARGV[4]: Unique request identifier for member uniqueness (string)

local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window_size_ms = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])
local request_id = ARGV[4]

local window_start_ms = now_ms - window_size_ms

-- Step 1: Remove all requests older than the sliding window start
redis.call("ZREMRANGEBYSCORE", key, "-inf", window_start_ms)

-- Step 2: Count requests remaining within current window
local current_count = redis.call("ZCARD", key)

local allowed = 0
local remaining = 0
local reset_after_ms = 0

if current_count < limit then
  -- Allowed: Add current request timestamp into the sorted set
  redis.call("ZADD", key, now_ms, request_id)
  redis.call("PEXPIRE", key, window_size_ms)
  allowed = 1
  remaining = limit - (current_count + 1)
  reset_after_ms = 0
else
  -- Rate limited: Calculate when the oldest request in the window expires
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

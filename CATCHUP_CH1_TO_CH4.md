# Chapter 1 to 4 Practical Catch-Up Sprint (Week 0)

> **Objective**: Bridge the gap between theoretical reading and production muscle memory. In 4 focused evening sessions, build, benchmark, and break the foundational components of modern distributed architectures.

---

## Sprint Schedule Overview

| Session | Focus Area | Chapter | Key Artifacts | Verification Command |
| :--- | :--- | :--- | :--- | :--- |
| **Session 1** | Scale From Zero to Millions | Ch. 1 | Stateless Fastify + Redis Cache-Aside + Primary/Replica DB Routing | `npm run test:ch01` |
| **Session 2** | Back-of-the-Envelope Capacity Estimation | Ch. 2 | Interactive CLI (`npm run estimate`) + Memory Footprint Benchmarks | `npm run estimate && npm run bench:memory` |
| **Session 3** | System Design Template & Benchmarking | Ch. 3 | Production RFC Template (`DESIGN_TEMPLATE.md`) + Autocannon Harness | `npm run test:harness` |
| **Session 4** | Atomic Distributed Rate Limiter | Ch. 4 | Redis Lua Sliding Window & Token Bucket Fastify Plugin | `npm run bench:rate-limiter` |

---

## Session 1: Scale From Zero to Millions (Chapter 1)

**Goal**: Transform a stateful, single-server monolithic mindset into a stateless, horizontally scalable tiered architecture.

### Implementation Checklist
- [ ] **Stateless Fastify API Server**
  - [ ] Session state externalized completely to Redis (JWT / Redis session tokens).
  - [ ] No in-memory state that prevents round-robin traffic splitting.
- [ ] **Cache-Aside Pattern (Lazy Loading)**
  - [ ] Read path: check Redis cache first -> on cache miss, query Postgres replica -> populate Redis with TTL.
  - [ ] Write path: update Postgres primary -> invalidate or update Redis cache key (Cache Invalidation).
  - [ ] Cache stampede prevention stub using probabilistic early expiration (XFetch) or singleflight mutex.
- [ ] **Database Replication Routing Abstraction**
  - [ ] Connection pool manager separating write operations (Primary `localhost:5432`) from read queries (Replica pool).
  - [ ] Replication lag tolerance fallback (read-your-own-writes session routing).

### Acceptance Criteria
1. Fastify node boots in stateless mode; killing a node causes zero lost user sessions.
2. Under 1,000 requests to `/users/:id`, cache hit ratio reaches ≥ 95% after the initial cold request.
3. Mutation requests (`POST /users`, `PUT /users/:id`) execute strictly against the primary database and trigger cache invalidation.

### Verification Commands
```bash
# Verify unit and integration behavior
npm run --workspace=@system-design/ch01-scale-zero-to-millions test

# Run read-heavy load test with autocannon (expecting sub-3ms p99 via cache)
npx autocannon -c 50 -d 10 -p 10 http://localhost:3001/api/users/user-42
```

---

## Session 2: Back-of-the-Envelope Capacity Estimator (Chapter 2)

**Goal**: Stop guessing server counts and storage sizes. Codify capacity math into an interactive, reusable CLI and measure real-world V8 memory overhead.

### Implementation Checklist
- [ ] **Interactive Calculation Engine (`packages/ch02-back-of-envelope-calc`)**
  - [ ] Daily Active Users (DAU) to QPS conversion (`QPS = DAU × Requests_Per_Day / 86,400`).
  - [ ] Peak QPS calculation (`Peak_QPS = QPS × Peak_Multiplier`, standard 2× to 3×).
  - [ ] Bandwidth projection (Read Bandwidth vs. Write Bandwidth in MB/s and Gbps).
  - [ ] 5-year storage growth with replication factor (`Daily_Bytes × 365 × 5 × Replication_Factor`).
  - [ ] 80-20 Pareto Rule Cache RAM sizing: 20% of daily active read data held in memory + 25% system headroom.
- [ ] **Presets Library**
  - [ ] Twitter / X timeline (300M DAU, 800M tweets/day, 10:1 read-to-write ratio).
  - [ ] Chat / Messaging (100M DAU, 50 messages/day, 1KB average message).
  - [ ] Video Platform (50M DAU, 5 views/day, 1080p stream bitrate estimation).
- [ ] **V8 Memory Footprint Benchmark (`bench:memory`)**
  - [ ] Generate 1,000,000 records as standard V8 JavaScript Objects.
  - [ ] Generate 1,000,000 records using Compact TypedArrays (`Uint32Array`, `Float64Array`).
  - [ ] Generate 1,000,000 records using packed raw binary Buffers.
  - [ ] Compare heap consumption, GC pressure, and serialization latency.

### Acceptance Criteria
1. Running `npm run estimate` prints a formatted terminal table detailing QPS, Storage, Bandwidth, and RAM requirements.
2. Passing `--preset twitter` reproduces Alex Xu's Chapter 2 reference numbers within 5% tolerance.
3. The memory benchmark demonstrates a > 4× memory footprint reduction when migrating from plain V8 objects to compact binary structs for high-volume caching.

### Verification Commands
```bash
# Run interactive capacity estimator
npm run estimate

# Run predefined Twitter estimation
npm run --workspace=@system-design/ch02-back-of-envelope-calc estimate -- --preset twitter

# Execute 1M records memory comparison
npm run bench:memory
```

---

## Session 3: Production System Design RFC Template & Harness (Chapter 3)

**Goal**: Standardize the 4-step interview and production architecture framework into an actionable RFC template backed by empirical load testing.

### Implementation Checklist
- [ ] **Standardized RFC Document (`DESIGN_TEMPLATE.md`)**
  - [ ] Section 1: Scope, Functional & Non-Functional Requirements, Capacity Estimations.
  - [ ] Section 2: High-Level Architecture, End-to-End Flow Diagram, API Contracts (OpenAPI/Zod).
  - [ ] Section 3: Deep Dives (Data Models, Partitioning/Sharding, Cache Topologies, Failure Modes).
  - [ ] Section 4: Wrap-Up, Bottleneck Analysis, Operational Runbook, SLOs & Alert Thresholds.
- [ ] **Empirical Autocannon Benchmarking Harness**
  - [ ] Reusable Node.js/TypeScript benchmark runner reporting p50, p90, p99, p99.9 latencies, error rates, and requests/second.
  - [ ] Automatic threshold validation: fail pipeline if error rate > 0.1% or p99 > 50ms.

### Acceptance Criteria
1. `DESIGN_TEMPLATE.md` is populated with concrete architectural guidelines and diagrams.
2. The benchmarking harness can be imported and executed against any Fastify route with a single function call.

### Verification Commands
```bash
# Test the benchmark harness against a mock endpoint
npm run --workspace=@system-design/ch03-design-template test
```

---

## Session 4: Atomic Distributed Rate Limiter (Chapter 4)

**Goal**: Build a bank-grade rate limiter plugin for Fastify using atomic Redis Lua scripts to eliminate race conditions under extreme concurrent load.

### Implementation Checklist
- [ ] **Token Bucket Algorithm (Lua Script)**
  - [ ] Key: Redis Hash holding `tokens` (float) and `last_refreshed_ms` (integer timestamp).
  - [ ] Atomically calculates tokens refilled based on elapsed time:
    `refilled = tokens + (elapsed_sec × refill_rate)` capped at `bucket_capacity`.
  - [ ] Decrements requested tokens on allow; preserves state with key TTL = refill window.
- [ ] **Sliding Window Counter / Log (Lua Script)**
  - [ ] Key: Redis Sorted Set (ZSET) storing request timestamps as scores and unique request IDs as members.
  - [ ] Atomically prunes expired timestamps: `ZREMRANGEBYSCORE key 0 (now - window_size_ms)`.
  - [ ] Evaluates current count with `ZCARD`: allows request if `count < limit` and executes `ZADD`.
  - [ ] Queries lowest score to compute exact reset time.
- [ ] **Fastify Rate-Limiter Plugin (`fastify-rate-limit-lua`)**
  - [ ] Flexible client identifier extractor: API Key (`x-api-key`), authenticated User ID, or Client IP.
  - [ ] RFC-compliant response headers:
    - `X-RateLimit-Limit`: configured threshold.
    - `X-RateLimit-Remaining`: available requests/tokens.
    - `X-RateLimit-Reset`: UNIX timestamp when quota replenishes.
  - [ ] On limit breach: responds with HTTP 429 Too Many Requests, `Retry-After: <seconds>` header, and structured JSON error payload.
- [ ] **Autocannon Concurrency Burst Benchmark**
  - [ ] Benchmark script firing 5,000 requests across 50 concurrent connections in a 1-second burst.
  - [ ] Verifies exact mathematical cutoff (e.g., limit = 100 results in exactly 100 200-OKs and 4,900 429-Too-Many-Requests with zero drift).

### Acceptance Criteria
1. Under 50 concurrent workers, exactly the configured request limit passes; 0 race conditions, 0 over-admissions.
2. All rejected requests return HTTP 429 with accurate `Retry-After` and `X-RateLimit-*` headers.
3. Lua script execution time in Redis stays under 0.5ms per invocation.

### Verification Commands
```bash
# Run unit & integration tests
npm test

# Start the showcase server
npm run start:rate-limiter

# Run the autocannon race-condition verification test
npm run bench:rate-limiter
```

---

## Sprint Completion Checklist

- [ ] All 4 sessions completed with verified code.
- [ ] Unit & integration test suites passing cleanly (`npm test`).
- [ ] Autocannon race condition tests confirmed 0 over-admissions on rate limiting.
- [ ] Git commit tagged: `v0.1.0-foundations-complete`.

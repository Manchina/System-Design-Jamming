# System-Design-Jamming

> Production-grade, hands-on distributed systems monorepo built in **TypeScript + Fastify + Docker**.
> Dual-purpose engine:
> 1. Complete implementation of Alex Xu's *"System Design Interview — Volume 1"* (Chapters 1–15 with a Week 0 foundations catch-up).
> 2. `fastify-distributed-ai-kit`: A plug-and-play hackathon & production starter kit featuring Redis Lua rate limiting, consistent hashing, Snowflake IDs, pgvector hybrid search, and OpenTelemetry observability.

---

## Architecture Overview

```text
                                  +---------------------------------------+
                                  |            Client / Gateway           |
                                  +-------------------+-------------------+
                                                      |
                                          HTTP / REST | WebSocket / SSE
                                                      v
                                  +---------------------------------------+
                                  |       Fastify Stateless Nodes         |
                                  |  - Zod type provider                  |
                                  |  - Pino structured logging            |
                                  |  - OpenTelemetry distributed tracing  |
                                  +-------------------+-------------------+
                                                      |
                 +-------------------+----------------+--------------------+
                 |                   |                                     |
                 v                   v                                     v
       +-------------------+  +--------------------------------+  +-------------------+
       | PostgreSQL 16     |  | Redis Cluster / Shards         |  | MinIO S3 Storage  |
       | + pgvector        |  | - Port 6379: Primary           |  | - Presigned URLs  |
       | - Primary/Replica |  | - Port 6380: Shard 01          |  | - Video/Blob sync |
       | - Hybrid Search   |  | - Port 6381: Shard 02          |  | - Webhook pipeline|
       | - Base62 URLs     |  | - Port 6382: Shard 03          |  +-------------------+
       +-------------------+  +--------------------------------+
```

---

## Monorepo Layout

```text
├── infra/
│   └── docker-compose.yml       # Postgres (pgvector) + 4 Redis instances + MinIO
├── packages/
│   └── shared/                  # Config loader, Pino logger, OTel tracer stub, Snowflake ID
├── modules/
│   ├── 00-catchup-foundations/
│   │   ├── ch01-scale-zero-to-millions/  # Stateless Fastify + Redis cache-aside + DB router
│   │   ├── ch02-back-of-envelope-calc/   # Interactive capacity CLI + memory benchmarks
│   │   ├── ch03-design-template/         # Production RFC template + autocannon harness
│   │   └── ch04-rate-limiter/            # Token Bucket & Sliding Window with atomic Redis Lua
│   ├── 01-consistent-hashing/            # Consistent hash ring with virtual nodes & redistribution
│   ├── 02-kv-store/                      # Read/write-through cache + singleflight stampede guard
│   ├── 03-unique-id-generator/           # 64-bit Snowflake ID with clock-drift detection
│   ├── 04-url-shortener/                 # Base62 encoder + Postgres index + Redis hot cache
│   ├── 05-async-queues-crawler/          # BullMQ worker pool, exponential backoff, DLQ
│   ├── 06-realtime-streaming/            # SSE token streaming + WebSockets Redis Pub/Sub fanout
│   ├── 07-hybrid-search/                 # pgvector embeddings + BM25 full-text RRF fusion
│   ├── 08-media-presigned-uploads/       # S3 presigned upload flow + async webhook worker
│   └── 09-mcp-and-ai-evals/              # TypeScript MCP server + Zod guardrails + LLM evals
├── CATCHUP_CH1_TO_CH4.md        # 4-session practical sprint checklist for Foundations
├── ROADMAP_CHECKLIST.md         # 12-week comprehensive mastery roadmap
├── package.json                 # Monorepo workspaces configuration
└── tsconfig.json                # Root strict TypeScript configuration
```

---

## Quickstart

### 1. Spin up Infrastructure

Start PostgreSQL with pgvector, Redis (primary + 3 shards), and MinIO:

```bash
docker compose -f infra/docker-compose.yml up -d
```

Verify services are healthy:
- **PostgreSQL (pgvector)**: `localhost:5432` (user: `postgres`, pass: `postgres`, db: `system_design`)
- **Redis Primary**: `localhost:6379`
- **Redis Shard 1**: `localhost:6380`
- **Redis Shard 2**: `localhost:6381`
- **Redis Shard 3**: `localhost:6382`
- **MinIO S3**: `localhost:9000` (Console: `http://localhost:9001`)

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Tonight's Implementations

#### Chapter 2: Back-of-the-Envelope Capacity Estimator & Memory Benchmark

```bash
# Interactive capacity estimation CLI
npm run estimate

# Memory footprint benchmark (1M plain JSON objects vs compact structs)
npm run bench:memory
```

#### Chapter 4: Atomic Redis Lua Rate Limiter (Token Bucket & Sliding Window)

```bash
# Run unit & integration tests
npm test

# Start the rate limiter showcase server
npm run start:rate-limiter

# Execute autocannon concurrency burst test (verifies zero race conditions)
npm run bench:rate-limiter
```

---

## Interactive Checklists

- [CATCHUP_CH1_TO_CH4.md](file:///c:/Users/ADMIN/Desktop/System-Design-Jamming/CATCHUP_CH1_TO_CH4.md): 4-session catch-up sprint for Chapters 1 through 4 with concrete acceptance criteria and verification commands.
- [ROADMAP_CHECKLIST.md](file:///c:/Users/ADMIN/Desktop/System-Design-Jamming/ROADMAP_CHECKLIST.md): 12-week master checklist mapping Chapters 5–15 and hackathon production extensions.

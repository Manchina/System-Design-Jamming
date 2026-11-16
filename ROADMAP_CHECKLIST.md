# 12-Week System Design & Distributed AI Mastery Roadmap

> Master curriculum mapping **Alex Xu's System Design Interview (Vol. 1)** alongside the **`fastify-distributed-ai-kit`** production starter kit.
>
> Each module requires four discrete gates before it is certified production-ready:
> 1. Core implementation written in strict TypeScript.
> 2. Docker integration test passing via `vitest`.
> 3. Load or failure benchmark verified via `autocannon` or chaos node drop.
> 4. Architecture diagram sketched from memory and documented in `README.md`.

---

## Roadmap Schedule Summary

| Week | Target Module | Chapter Reference | Key Architecture Pattern |
| :--- | :--- | :--- | :--- |
| **Week 0** | Foundations Catch-Up | Ch. 1 to 4 | Stateless Fastify, Capacity Math, Rate Limiting (Redis Lua) |
| **Week 1** | Consistent Hashing | Ch. 5 | Virtual Nodes, Hash Ring, Minimal Key Redistribution |
| **Week 2** | Key-Value Store | Ch. 6 | Singleflight Stampede Guard, Read/Write-Through Cache |
| **Week 3** | Unique ID Generator | Ch. 7 | 64-bit Snowflake ID, Clock-Drift Backward Guard |
| **Week 4** | URL Shortener | Ch. 8 | Base62 Bijective Encoding, Postgres Indexing, Hot Cache |
| **Week 5** | Web Crawler & Job Queue | Ch. 9 & 10 | BullMQ Worker Pool, Deduplication, Exponential Backoff, DLQ |
| **Week 6** | Real-Time Chat & Streaming | Ch. 11 & 12 | SSE Token Streaming, WebSockets, Redis Pub/Sub Fanout |
| **Week 7** | Hybrid Search Engine | Ch. 13 | Postgres pgvector Embeddings + BM25 Full-Text RRF Fusion |
| **Week 8** | Cloud Media Storage | Ch. 14 & 15 | MinIO/S3 Presigned URLs, Async Webhook Processing Pipeline |
| **Week 9** | Custom MCP Server | AI Kit Module 1 | Model Context Protocol in TypeScript, Zod Schema Guardrails |
| **Week 10** | OpenTelemetry Observability | AI Kit Module 2 | Distributed Tracing, Fastify Trace Context, W3C Traceparent |
| **Week 11** | Chaos Engineering & Resilience | Advanced | Redis Shard Partitioning, Circuit Breakers, Bulkheading |
| **Week 12** | Production Launch & Benchmarks | Final | End-to-End Stress Test, 50,000 QPS Load Validation, Packaging |

---

## Detailed Weekly Milestones

### Week 0: Foundations Catch-Up (Chapters 1 to 4)
- **Module**: `modules/00-catchup-foundations/`
- [ ] Core implementation written in TypeScript
- [ ] Docker integration test passing (`vitest`)
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
- [ ] Architecture diagram sketched from memory & `README.md` documented
- *Deliverables*: See [CATCHUP_CH1_TO_CH4.md](file:///c:/Users/ADMIN/Desktop/System-Design-Jamming/CATCHUP_CH1_TO_CH4.md) for session-by-session checklist.

---

### Week 1: Consistent Hashing Ring (Chapter 5)
- **Module**: `modules/01-consistent-hashing/`
- **Focus**: Dynamic routing across multiple Redis shard instances (`localhost:6380`, `6381`, `6382`) with minimal redistribution during node addition or failure.
- [ ] Core implementation written in TypeScript
  - [ ] MD5/MurmurHash3 ring mapping keys to a 32-bit integer space [0, 2^32 - 1].
  - [ ] Virtual nodes (default: 100 to 250 replicas per physical node) to eliminate hotspots.
  - [ ] Binary search (`O(log N)`) to resolve clockwise target node for any cache key.
- [ ] Docker integration test passing (`vitest`)
  - [ ] Connects to all 3 Redis shard instances defined in `infra/docker-compose.yml`.
  - [ ] Route keys accurately across healthy nodes.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Add a 4th node: verify only `K/N` keys migrate (where `K` is total keys, `N` is node count).
  - [ ] Kill 1 node container: verify graceful fallback with `O(K/N)` remap without cluster disruption.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 2: Distributed Key-Value Store (Chapter 6)
- **Module**: `modules/02-kv-store/`
- **Focus**: High-concurrency caching with read-through, write-through, and zero-stampede singleflight synchronization.
- [ ] Core implementation written in TypeScript
  - [ ] Singleflight (request coalescing) mutex: ensure 1,000 concurrent requests for a cold key issue only 1 database query.
  - [ ] Configurable cache policies: Write-Through, Write-Behind, and Cache-Aside.
  - [ ] Probabilistic early expiration (XFetch algorithm) to refresh keys before TTL expiration.
- [ ] Docker integration test passing (`vitest`)
  - [ ] Cold cache benchmark asserting exactly 1 Postgres query under 500 concurrent requests.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Autocannon burst on expired key: assert 0 cache stampede spikes on Postgres.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 3: 64-bit Snowflake ID Generator (Chapter 7)
- **Module**: `modules/03-unique-id-generator/`
- **Focus**: Distributed, time-sortable 64-bit integer IDs supporting 4,096 IDs per millisecond per node without database coordination.
- [ ] Core implementation written in TypeScript
  - [ ] Bit layout: 1 bit unused + 41 bits timestamp + 5 bits datacenter ID + 5 bits worker ID + 12 bits sequence number.
  - [ ] Custom epoch support (e.g., 2026-01-01) extending generator lifetime to ~69 years.
  - [ ] System clock backward drift detection: pause or reject if current time is behind last timestamp.
- [ ] Docker integration test passing (`vitest`)
  - [ ] Multi-worker concurrent loop: assert 100,000 IDs are generated with 0 collisions and strict monotonic ordering.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Throughput benchmark: measure pure CPU ID generation rate (> 2,000,000 IDs/sec on single core).
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 4: High-Performance URL Shortener (Chapter 8)
- **Module**: `modules/04-url-shortener/`
- **Focus**: Bijective Base62 encoding, read-heavy caching with Redis, and unique collision-free ID resolution.
- [ ] Core implementation written in TypeScript
  - [ ] Bijective Base62 encoder/decoder (`[0-9a-zA-Z]`) mapping 64-bit integers to short 7-character slugs.
  - [ ] PostgreSQL schema with B-Tree index on `short_code` and `created_at`.
  - [ ] Redis hot-key cache layer with 301/302 redirect handlers.
- [ ] Docker integration test passing (`vitest`)
  - [ ] End-to-end flow: generate short link -> lookup redirection -> verify cache hit on second lookup.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] 10,000 QPS redirect benchmark: ensure p99 latency < 2ms via Redis cache hit.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 5: Distributed Web Crawler & Job Queue (Chapters 9 & 10)
- **Module**: `modules/05-async-queues-crawler/`
- **Focus**: Asynchronous worker pipeline using BullMQ, URL deduplication (Bloom filter/Redis Set), exponential backoff, and Dead-Letter Queues (DLQ).
- [ ] Core implementation written in TypeScript
  - [ ] Producer-Consumer pattern with BullMQ backed by Redis.
  - [ ] URL frontier with domain-based politeness delay and rate limiting.
  - [ ] Idempotency key tracking in Redis to prevent duplicate processing.
  - [ ] Exponential backoff retry strategy with Dead-Letter Queue routing for poison pills.
- [ ] Docker integration test passing (`vitest`)
  - [ ] Process batch of 1,000 jobs: verify deduplication ignores re-queued URLs.
  - [ ] Trigger worker failure: verify job lands in DLQ after exactly 3 retries.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Worker drain rate: verify 10 worker threads process > 1,500 jobs/sec.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 6: Real-Time Streaming & WebSocket Fanout (Chapters 11 & 12)
- **Module**: `modules/06-realtime-streaming/`
- **Focus**: Server-Sent Events (SSE) token streaming for LLMs and WebSockets with Redis Pub/Sub multi-node message fanout.
- [ ] Core implementation written in TypeScript
  - [ ] Fastify SSE endpoint streaming chunked responses (`text/event-stream`).
  - [ ] WebSocket connection manager with heartbeat ping/pong.
  - [ ] Redis Pub/Sub backplane routing channel messages across independent Fastify nodes.
- [ ] Docker integration test passing (`vitest`)
  - [ ] Connect 2 distinct Fastify instances; send message on Node A, assert receipt on Node B client via Redis Pub/Sub.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] 1,000 concurrent active WebSocket connections receiving broadcast messages.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 7: Hybrid Search Engine with pgvector & BM25 (Chapter 13)
- **Module**: `modules/07-hybrid-search/`
- **Focus**: Semantic vector search combined with PostgreSQL lexical full-text search using Reciprocal Rank Fusion (RRF).
- [ ] Core implementation written in TypeScript
  - [ ] PostgreSQL table with `vector(1536)` column and HNSW cosine distance index (`vector_cosine_ops`).
  - [ ] Full-text search `tsvector` column with GIN index for lexical search.
  - [ ] Reciprocal Rank Fusion (RRF) algorithm combining vector rank and lexical rank:
    `RRF_Score = (1 / (60 + Lexical_Rank)) + (1 / (60 + Vector_Rank))`.
- [ ] Docker integration test passing (`vitest`)
  - [ ] Insert sample document vectors; execute hybrid query; verify top-ranked result merges keyword and semantic meaning.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Query latency benchmark over 50,000 embeddings with HNSW indexing (target: < 15ms p95).
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 8: Presigned S3 Media Upload & Webhook Pipeline (Chapters 14 & 15)
- **Module**: `modules/08-media-presigned-uploads/`
- **Focus**: Direct client-to-storage uploads bypassing API servers via MinIO/S3 presigned URLs, backed by asynchronous processing webhooks.
- [ ] Core implementation written in TypeScript
  - [ ] Presigned `PUT` URL generator with strict content-type and size constraints.
  - [ ] MinIO bucket notification / webhook endpoint receiving upload completion events.
  - [ ] Asynchronous thumbnail generation and metadata extraction worker.
- [ ] Docker integration test passing (`vitest`)
  - [ ] Request presigned URL -> PUT binary payload directly to MinIO -> verify webhook triggers metadata update in Postgres.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Measure API server resource usage: verify API CPU remains idle during large file transfers.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 9: Model Context Protocol (MCP) Server & AI Guardrails
- **Module**: `modules/09-mcp-and-ai-evals/`
- **Focus**: Custom TypeScript MCP server exposing distributed system tools to LLM agents with strict Zod validation and eval harnesses.
- [ ] Core implementation written in TypeScript
  - [ ] MCP Server implementing tools: `inspect_cache`, `query_pgvector`, `get_rate_limit_metrics`.
  - [ ] Zod schema input validation and error sanitization.
  - [ ] LLM evaluation harness comparing model reasoning against expected tool-call outputs.
- [ ] Docker integration test passing (`vitest`)
  - [ ] MCP client-server loop testing all tool invocations and schema rejections.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Tool execution latency: assert tool handler overhead < 5ms.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 10: OpenTelemetry Distributed Tracing & Observability
- **Module**: `packages/shared/` & across modules
- **Focus**: Full distributed trace propagation across Fastify HTTP, Redis operations, and Postgres queries using OpenTelemetry.
- [ ] Core implementation written in TypeScript
  - [ ] W3C `traceparent` header extraction and injection across service boundaries.
  - [ ] Pino logger integration: automatically attach `traceId` and `spanId` to every structured log log line.
  - [ ] Custom OpenTelemetry spans measuring Redis Lua script execution and database queries.
- [ ] Docker integration test passing (`vitest`)
  - [ ] Verify HTTP request receives `traceId` and propagates it downstream to background workers.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Measure tracing overhead: assert telemetry adds < 1% latency to request lifecycle.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 11: Resilience, Chaos Testing & Partitioning
- **Module**: `infra/` & multi-module integration
- **Focus**: System survival during network partitions, Redis shard crashes, and database failovers.
- [ ] Core implementation written in TypeScript
  - [ ] Circuit breaker pattern wrapping database and cache calls.
  - [ ] Graceful degradation: cache outage falls back to database with rate-limiting throttling.
- [ ] Docker integration test passing (`vitest`)
  - [ ] Chaos script: automatically kill 1 Redis shard container during active traffic.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Continuous autocannon run: assert system maintains > 95% availability during single-node failure.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

### Week 12: Production Hardening, 50k QPS Stress Test & Starter Kit Packaging
- **Module**: Root monorepo & `fastify-distributed-ai-kit`
- **Focus**: Final production validation, documentation polish, and zero-configuration starter kit template.
- [ ] Core implementation written in TypeScript
  - [ ] Clean exports in `packages/shared` and all standalone modules.
  - [ ] One-click starter template script (`npm run create-kit-app`).
- [ ] Docker integration test passing (`vitest`)
  - [ ] Full monorepo integration test suite running in CI with `npm test`.
- [ ] Load/failure benchmark verified (`autocannon` / node drop test)
  - [ ] Multi-core clustered Fastify stress test achieving > 50,000 QPS on local infrastructure.
- [ ] Architecture diagram sketched from memory & `README.md` documented

---

## Progress Tracking Sign-off

| Milestone | Target Date | Verified By | Status |
| :--- | :--- | :--- | :--- |
| **Week 0: Catch-Up Foundations** | Sprint 1 | Staff Architect | In Progress |
| **Weeks 1 to 4: Core Data Patterns** | Month 1 | Staff Architect | Scheduled |
| **Weeks 5 to 8: Streaming & Search** | Month 2 | Staff Architect | Scheduled |
| **Weeks 9 to 12: AI Kit & Production** | Month 3 | Staff Architect | Scheduled |

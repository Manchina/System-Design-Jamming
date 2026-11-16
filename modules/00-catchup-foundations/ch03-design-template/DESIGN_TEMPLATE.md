# RFC: [System / Feature Name]

- **Author(s)**: Staff Distributed Systems Architect
- **Status**: Draft | In Review | Approved | Implemented
- **Target Release**: Q[X] 2026
- **Last Updated**: 2026-11-16

---

## 1. Executive Summary & Scope

### 1.1 Context & Problem Statement
Describe the business problem, limitations of the current architecture, and why this distributed component is being built.

### 1.2 Out of Scope
Clarify explicit non-goals to prevent scope creep during design review and implementation.

---

## 2. Requirements & Capacity Estimation

### 2.1 Functional Requirements
1. The system must ...
2. Users can ...
3. When event X occurs, the system must emit ...

### 2.2 Non-Functional Requirements (SLAs & SLOs)
- **High Availability**: 99.99% availability (target downtime < 52.6 minutes/year).
- **Latency**: p95 read latency < 15ms, p99 write latency < 50ms.
- **Consistency**: Eventual consistency for timeline feeds; strong consistency for balance / quota states.
- **Durability**: Zero data loss for confirmed writes (multi-AZ replication).

### 2.3 Back-of-the-Envelope Capacity Estimations
*Formulas generated via `@system-design/ch02-back-of-envelope-calc`.*

| Metric | Target Value | Calculation Derivation |
| :--- | :--- | :--- |
| **Daily Active Users (DAU)** | 100,000,000 | Baseline business assumption |
| **Average Write QPS** | 2,315 req/s | (100M DAU × 2 writes/day) / 86,400 sec |
| **Peak Write QPS (2×)** | 4,630 req/s | Write QPS × 2.0 peak multiplier |
| **Read-to-Write Ratio** | 10 : 1 | Read heavy workload |
| **Average Read QPS** | 23,150 req/s | 2,315 Write QPS × 10 |
| **Peak Read QPS (2×)** | 46,300 req/s | Read QPS × 2.0 peak multiplier |
| **Daily Ingest Storage** | ~186 GB/day | 200M writes × 1,000 bytes payload |
| **5-Year Storage (3× Repl)** | ~1,018 TB | 186 GB × 365 × 5 × 3 replicas |
| **Cache Memory (80/20 Rule)** | ~465 GB RAM | 20% of 1.86 TB daily read volume + 25% buffer |

---

## 3. High-Level Architecture

### 3.1 Architectural Diagram

```text
                               +-----------------------------+
                               |     Client / API Gateway    |
                               +--------------+--------------+
                                              |
                                              v
                               +-----------------------------+
                               |    Stateless Fastify API    |
                               |    - Rate Limiter (Lua)     |
                               |    - OTel Distributed Trace |
                               +-------+---------------+-----+
                                       |               |
                         Cache-Aside   |               | Persistent Write
                              v        |               v
                     +-----------------+--+   +-------------------+
                     | Redis Shard Ring   |   | PostgreSQL 16     |
                     | - Consistent Hash  |   | - Primary (Write) |
                     | - TTL Invalidation |   | - Replicas (Read) |
                     +--------------------+   +-------------------+
```

### 3.2 Key API Contracts

```json
{
  "endpoint": "POST /api/v1/entities",
  "request": {
    "title": "Distributed Cache Pattern",
    "ownerId": "usr_99812",
    "metadata": {
      "retries": 3,
      "partitionKey": "tenant_42"
    }
  },
  "response": {
    "id": "1849102941049102",
    "status": "CREATED",
    "createdAt": "2026-11-16T10:00:00.000Z"
  }
}
```

---

## 4. Deep-Dive Design Decisions

### 4.1 Data Modeling & Storage Engine
- **Primary Datastore**: PostgreSQL 16 with B-Tree indexes on indexed search keys and HNSW vector indexing for embeddings.
- **Cache Layer**: Redis 7 cluster utilizing atomic Lua scripting for synchronization.

### 4.2 Distributed Synchronization & Concurrency Control
- Rate Limiting algorithm chosen: Sliding Window Counter vs. Token Bucket.
- Singleflight mutex guard preventing cache stampedes under cold starts.

### 4.3 Failure Modes & Mitigations

| Failure Mode | Impact | Automated Mitigation |
| :--- | :--- | :--- |
| **Redis Primary Crash** | Read latency increase | Fallback to database replicas with rate-limiting circuit breakers. |
| **Database Primary Failover** | Transient write errors (10-30s) | Fastify retries with exponential jitter; clients receive 503 retryable. |
| **Clock Backward Drift** | Snowflake ID duplicate collision | Generator throws `ClockMovedBackwardsError` and pauses sequence allocation. |
| **Network Partition** | Shard isolation | Consistent hash ring dynamically bypasses dead virtual nodes. |

---

## 5. Empirical Verification & Autocannon Harness

Post-implementation performance must be benchmarked using the built-in test harness:

```bash
# Run 50 concurrent connections over 10 seconds against target route
npx tsx modules/00-catchup-foundations/ch03-design-template/src/benchmark-harness.ts --url http://localhost:3000/api/endpoint --connections 50 --duration 10
```

### Acceptance Gate
- Error Rate: 0.00% under normal load, < 0.1% during node failover.
- Latency SLO: p95 < 15ms, p99 < 40ms.
- Verification command passes cleanly in CI.

# Chapters 9 & 10: Asynchronous Job Queues, Crawler & Notification Worker

## Architectural Scope
- Distributed job processing with BullMQ and Redis backplane.
- URL deduplication frontier via Redis sets / Bloom filters.
- Exponential backoff retry policies with Dead-Letter Queue (DLQ) poison-pill isolation.
- Idempotency key tracking to guarantee exactly-once side-effects.

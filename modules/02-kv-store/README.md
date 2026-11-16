# Chapter 6: Distributed Key-Value Store & Singleflight Cache Stampede Guard

## Architectural Scope
- In-memory and distributed cache layer with configurable write policies: Write-Through, Write-Behind, Cache-Aside.
- Singleflight (Request Coalescing) mutex: guarantees that 1,000 concurrent cold-cache misses execute exactly 1 persistent query.
- XFetch Probabilistic Early Expiration: background refresh before TTL expiration to achieve 0ms cache-refresh latency for end users.

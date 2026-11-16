# Chapter 8: High-Performance URL Shortener

## Architectural Scope
- Bijective Base62 encoding (`[0-9a-zA-Z]`) mapping integer Snowflake IDs to compact 7-character URLs.
- Dual-tier resolution: Hot-key caching in Redis (sub-2ms 301/302 redirects) + Postgres persistent storage.
- Collision-free design: IDs generated via Snowflake ID generator guarantee uniqueness without database roundtrips.

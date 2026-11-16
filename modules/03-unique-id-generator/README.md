# Chapter 7: 64-bit Snowflake Unique ID Generator

## Architectural Scope
- 64-bit time-sortable Snowflake ID generator implemented using BigInt.
- Epoch timestamp (41 bits) + Datacenter ID (5 bits) + Worker ID (5 bits) + Sequence (12 bits).
- Hardware clock backward drift detection with graceful waiting and error threshold.
- Standalone HTTP endpoint exposing bulk ID generation.

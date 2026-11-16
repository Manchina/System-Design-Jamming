# Chapter 5: Consistent Hashing Ring with Virtual Nodes

## Architectural Scope
- Consistent hash ring spanning integer space [0, 2^32 - 1].
- Virtual nodes (100–250 per physical node) to prevent non-uniform distribution and hotspots.
- Binary search lookup (`O(log N)`) to find the clockwise physical node responsible for a given partition key.
- Dynamic shard integration with Redis nodes (`localhost:6380`, `6381`, `6382`).
- Redistribution benchmark measuring `K/N` key migration when nodes join or leave.

## Acceptance Criteria
1. Adding a 4th node redistributes only ~1/4 of total keys.
2. Dropping a node redistributes its keys smoothly to successors without affecting non-neighboring keys.

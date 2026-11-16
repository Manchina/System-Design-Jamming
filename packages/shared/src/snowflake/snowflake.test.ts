import { describe, it, expect } from "vitest";
import { SnowflakeIdGenerator, ClockMovedBackwardsError } from "./index.js";

describe("SnowflakeIdGenerator", () => {
  it("should generate unique, strictly monotonic IDs within the same millisecond", () => {
    const generator = new SnowflakeIdGenerator({ workerId: 1, datacenterId: 1 });
    const count = 10000;
    const ids = new Set<bigint>();

    let lastId = 0n;
    for (let i = 0; i < count; i++) {
      const id = generator.nextId();
      expect(id).toBeGreaterThan(lastId);
      ids.add(id);
      lastId = id;
    }

    expect(ids.size).toBe(count);
  });

  it("should accurately deconstruct and parse generated IDs", () => {
    const workerId = 12;
    const datacenterId = 7;
    const generator = new SnowflakeIdGenerator({ workerId, datacenterId });

    const before = Date.now();
    const id = generator.nextId();
    const after = Date.now();

    const parsed = generator.parse(id);

    expect(parsed.workerId).toBe(workerId);
    expect(parsed.datacenterId).toBe(datacenterId);
    expect(parsed.sequence).toBeGreaterThanOrEqual(0);
    expect(parsed.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(parsed.timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  it("should throw error if workerId or datacenterId exceeds 31", () => {
    expect(() => new SnowflakeIdGenerator({ workerId: 32, datacenterId: 0 })).toThrow(/workerId/);
    expect(() => new SnowflakeIdGenerator({ workerId: 0, datacenterId: 32 })).toThrow(/datacenterId/);
  });

  it("should throw ClockMovedBackwardsError when clock drifts backwards significantly", () => {
    const generator = new SnowflakeIdGenerator({ workerId: 1, datacenterId: 1 });

    // Spy on private currentTime to simulate backward clock drift
    const originalCurrentTime = (generator as unknown as { currentTime: () => bigint }).currentTime;
    
    let mockTime = 1710000000000n;
    (generator as unknown as { currentTime: () => bigint }).currentTime = () => mockTime;

    generator.nextId();

    // Clock drifts back 100ms
    mockTime = 1710000000000n - 100n;

    expect(() => generator.nextId()).toThrow(ClockMovedBackwardsError);

    (generator as unknown as { currentTime: () => bigint }).currentTime = originalCurrentTime;
  });
});

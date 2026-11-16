import { describe, it, expect } from "vitest";
import { calculateCapacity, PRESETS } from "./calculator.js";

describe("Chapter 2 Capacity Calculator", () => {
  it("should calculate correct Twitter / X reference numbers", () => {
    const result = calculateCapacity(PRESETS.twitter);

    // 300M DAU × 2 tweets/day = 600M tweets/day
    // 600,000,000 / 86400 ≈ 6944 QPS
    expect(result.qps.writeQps).toBeCloseTo(6944, -1);
    expect(result.qps.peakWriteQps).toBe(result.qps.writeQps * 2);

    // 10:1 Read:Write ratio -> ~69,444 Read QPS
    expect(result.qps.readQps).toBeCloseTo(69444, -2);

    // Total QPS
    expect(result.qps.totalQps).toBe(result.qps.writeQps + result.qps.readQps);

    // Storage: 600M tweets × 280 bytes = 168 GB/day
    expect(result.storage.dailyGB).toBeCloseTo(156.46, -1);

    // 5-year replicated storage (3×)
    expect(result.storage.fiveYearReplicatedTB).toBeGreaterThan(800);

    // Cache sizing
    expect(result.cache.cacheRAMGB).toBeGreaterThan(0);
  });

  it("should adapt to custom parameters", () => {
    const custom = calculateCapacity({
      name: "Test System",
      dau: 10_000_000,
      readRatio: 1,
      writeRatio: 1,
      avgWritesPerUserPerDay: 1,
      avgWritePayloadBytes: 100,
      avgReadPayloadBytes: 100,
      peakMultiplier: 3.0,
      replicationFactor: 2,
    });

    // 10M / 86400 ≈ 116 QPS
    expect(custom.qps.writeQps).toBe(116);
    expect(custom.qps.peakWriteQps).toBe(116 * 3);
    expect(custom.storage.fiveYearReplicatedTB).toBe(custom.storage.fiveYearTB * 2);
  });
});

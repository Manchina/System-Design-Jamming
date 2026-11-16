/**
 * 64-bit Snowflake ID Generator (Alex Xu Chapter 7)
 *
 * Structure:
 * - 1 bit  : Sign bit (always 0 for positive numbers)
 * - 41 bits: Milliseconds since custom epoch (~69 years lifetime)
 * - 5 bits : Datacenter ID (0 to 31)
 * - 5 bits : Worker/Machine ID (0 to 31)
 * - 12 bits: Sequence counter (0 to 4095 per millisecond)
 */

export class ClockMovedBackwardsError extends Error {
  constructor(public readonly driftMs: number) {
    super(`Clock moved backwards by ${driftMs}ms. Refusing to generate ID.`);
    this.name = "ClockMovedBackwardsError";
  }
}

export interface SnowflakeConfig {
  workerId: number;
  datacenterId: number;
  epoch?: bigint; // Epoch in milliseconds. Defaults to 2024-01-01T00:00:00.000Z
}

export interface ParsedSnowflake {
  timestamp: Date;
  datacenterId: number;
  workerId: number;
  sequence: number;
  raw: bigint;
}

export class SnowflakeIdGenerator {
  // Bit allocation constants
  private static readonly WORKER_ID_BITS = 5n;
  private static readonly DATACENTER_ID_BITS = 5n;
  private static readonly SEQUENCE_BITS = 12n;

  // Maximum values
  private static readonly MAX_WORKER_ID = -1n ^ (-1n << SnowflakeIdGenerator.WORKER_ID_BITS); // 31
  private static readonly MAX_DATACENTER_ID = -1n ^ (-1n << SnowflakeIdGenerator.DATACENTER_ID_BITS); // 31
  private static readonly MAX_SEQUENCE = -1n ^ (-1n << SnowflakeIdGenerator.SEQUENCE_BITS); // 4095

  // Left bit shifts
  private static readonly WORKER_ID_SHIFT = SnowflakeIdGenerator.SEQUENCE_BITS; // 12
  private static readonly DATACENTER_ID_SHIFT =
    SnowflakeIdGenerator.SEQUENCE_BITS + SnowflakeIdGenerator.WORKER_ID_BITS; // 17
  private static readonly TIMESTAMP_SHIFT =
    SnowflakeIdGenerator.SEQUENCE_BITS +
    SnowflakeIdGenerator.WORKER_ID_BITS +
    SnowflakeIdGenerator.DATACENTER_ID_BITS; // 22

  private readonly epoch: bigint;
  private readonly workerId: bigint;
  private readonly datacenterId: bigint;

  private sequence = 0n;
  private lastTimestamp = -1n;

  constructor(config: SnowflakeConfig) {
    const { workerId, datacenterId, epoch = 1704067200000n } = config; // Jan 1, 2024

    if (BigInt(workerId) < 0n || BigInt(workerId) > SnowflakeIdGenerator.MAX_WORKER_ID) {
      throw new Error(`workerId must be between 0 and ${SnowflakeIdGenerator.MAX_WORKER_ID}`);
    }

    if (BigInt(datacenterId) < 0n || BigInt(datacenterId) > SnowflakeIdGenerator.MAX_DATACENTER_ID) {
      throw new Error(`datacenterId must be between 0 and ${SnowflakeIdGenerator.MAX_DATACENTER_ID}`);
    }

    this.workerId = BigInt(workerId);
    this.datacenterId = BigInt(datacenterId);
    this.epoch = epoch;
  }

  /**
   * Generates the next unique 64-bit Snowflake ID.
   */
  public nextId(): bigint {
    let currentTimestamp = this.currentTime();

    if (currentTimestamp < this.lastTimestamp) {
      const drift = Number(this.lastTimestamp - currentTimestamp);
      // Small drift tolerance: spin wait up to 5ms
      if (drift <= 5) {
        currentTimestamp = this.waitNextMillis(this.lastTimestamp);
      } else {
        throw new ClockMovedBackwardsError(drift);
      }
    }

    if (currentTimestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & SnowflakeIdGenerator.MAX_SEQUENCE;
      // Sequence overflow in the same millisecond: wait until next millisecond
      if (this.sequence === 0n) {
        currentTimestamp = this.waitNextMillis(this.lastTimestamp);
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = currentTimestamp;

    const id =
      ((currentTimestamp - this.epoch) << SnowflakeIdGenerator.TIMESTAMP_SHIFT) |
      (this.datacenterId << SnowflakeIdGenerator.DATACENTER_ID_SHIFT) |
      (this.workerId << SnowflakeIdGenerator.WORKER_ID_SHIFT) |
      this.sequence;

    return id;
  }

  /**
   * Generates next ID as a string to prevent precision loss in JS environments without BigInt.
   */
  public nextIdString(): string {
    return this.nextId().toString();
  }

  /**
   * Deconstructs a 64-bit Snowflake ID into its components.
   */
  public parse(id: bigint | string): ParsedSnowflake {
    const raw = typeof id === "string" ? BigInt(id) : id;

    const sequence = Number(raw & SnowflakeIdGenerator.MAX_SEQUENCE);
    const workerId = Number((raw >> SnowflakeIdGenerator.WORKER_ID_SHIFT) & SnowflakeIdGenerator.MAX_WORKER_ID);
    const datacenterId = Number(
      (raw >> SnowflakeIdGenerator.DATACENTER_ID_SHIFT) & SnowflakeIdGenerator.MAX_DATACENTER_ID
    );
    const timestampDelta = raw >> SnowflakeIdGenerator.TIMESTAMP_SHIFT;
    const timestampMs = Number(timestampDelta + this.epoch);

    return {
      timestamp: new Date(timestampMs),
      datacenterId,
      workerId,
      sequence,
      raw,
    };
  }

  private currentTime(): bigint {
    return BigInt(Date.now());
  }

  private waitNextMillis(lastTimestamp: bigint): bigint {
    let timestamp = this.currentTime();
    while (timestamp <= lastTimestamp) {
      timestamp = this.currentTime();
    }
    return timestamp;
  }
}

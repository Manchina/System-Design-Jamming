export interface CapacityInput {
  name: string;
  dau: number;
  readRatio: number;
  writeRatio: number;
  avgWritesPerUserPerDay: number;
  avgWritePayloadBytes: number;
  avgReadPayloadBytes: number;
  peakMultiplier?: number; // default: 2
  replicationFactor?: number; // default: 3
  cacheRatio?: number; // default: 0.20 (Pareto 80/20)
  cacheHeadroomMultiplier?: number; // default: 1.25 (25% buffer)
}

export interface CapacityOutput {
  name: string;
  dau: number;
  qps: {
    writeQps: number;
    peakWriteQps: number;
    readQps: number;
    peakReadQps: number;
    totalQps: number;
    peakTotalQps: number;
  };
  bandwidth: {
    writeBytesPerSec: number;
    writeMBPerSec: number;
    writeGbps: number;
    readBytesPerSec: number;
    readMBPerSec: number;
    readGbps: number;
    totalMBPerSec: number;
    totalGbps: number;
  };
  storage: {
    dailyBytes: number;
    dailyGB: number;
    annualTB: number;
    fiveYearTB: number;
    fiveYearReplicatedTB: number;
  };
  cache: {
    dailyActiveReadBytes: number;
    cacheRAMBytes: number;
    cacheRAMGB: number;
  };
}

const SECONDS_PER_DAY = 86400;
const BYTES_IN_MB = 1024 * 1024;
const BYTES_IN_GB = 1024 * 1024 * 1024;
const BYTES_IN_TB = 1024 * 1024 * 1024 * 1024;

export function calculateCapacity(input: CapacityInput): CapacityOutput {
  const peakMultiplier = input.peakMultiplier ?? 2.0;
  const replicationFactor = input.replicationFactor ?? 3;
  const cacheRatio = input.cacheRatio ?? 0.20;
  const cacheHeadroom = input.cacheHeadroomMultiplier ?? 1.25;

  // 1. QPS Calculations
  const dailyWrites = input.dau * input.avgWritesPerUserPerDay;
  const writeQps = Math.round(dailyWrites / SECONDS_PER_DAY);
  const peakWriteQps = Math.round(writeQps * peakMultiplier);

  const readToWriteRatio = input.readRatio / (input.writeRatio || 1);
  const dailyReads = dailyWrites * readToWriteRatio;
  const readQps = Math.round(dailyReads / SECONDS_PER_DAY);
  const peakReadQps = Math.round(readQps * peakMultiplier);

  const totalQps = writeQps + readQps;
  const peakTotalQps = peakWriteQps + peakReadQps;

  // 2. Bandwidth Calculations
  const writeBytesPerSec = writeQps * input.avgWritePayloadBytes;
  const writeMBPerSec = writeBytesPerSec / BYTES_IN_MB;
  const writeGbps = (writeBytesPerSec * 8) / 1_000_000_000;

  const readBytesPerSec = readQps * input.avgReadPayloadBytes;
  const readMBPerSec = readBytesPerSec / BYTES_IN_MB;
  const readGbps = (readBytesPerSec * 8) / 1_000_000_000;

  const totalMBPerSec = writeMBPerSec + readMBPerSec;
  const totalGbps = writeGbps + readGbps;

  // 3. Storage Growth Calculations
  const dailyBytes = dailyWrites * input.avgWritePayloadBytes;
  const dailyGB = dailyBytes / BYTES_IN_GB;
  const annualTB = (dailyBytes * 365) / BYTES_IN_TB;
  const fiveYearTB = annualTB * 5;
  const fiveYearReplicatedTB = fiveYearTB * replicationFactor;

  // 4. Cache Memory Sizing (80-20 Rule)
  // 20% of daily active read requests held in RAM to serve 80% of traffic
  const dailyActiveReadBytes = dailyReads * input.avgReadPayloadBytes;
  const cacheRAMBytes = dailyActiveReadBytes * cacheRatio * cacheHeadroom;
  const cacheRAMGB = cacheRAMBytes / BYTES_IN_GB;

  return {
    name: input.name,
    dau: input.dau,
    qps: {
      writeQps,
      peakWriteQps,
      readQps,
      peakReadQps,
      totalQps,
      peakTotalQps,
    },
    bandwidth: {
      writeBytesPerSec,
      writeMBPerSec: Number(writeMBPerSec.toFixed(2)),
      writeGbps: Number(writeGbps.toFixed(3)),
      readBytesPerSec,
      readMBPerSec: Number(readMBPerSec.toFixed(2)),
      readGbps: Number(readGbps.toFixed(3)),
      totalMBPerSec: Number(totalMBPerSec.toFixed(2)),
      totalGbps: Number(totalGbps.toFixed(3)),
    },
    storage: {
      dailyBytes,
      dailyGB: Number(dailyGB.toFixed(2)),
      annualTB: Number(annualTB.toFixed(2)),
      fiveYearTB: Number(fiveYearTB.toFixed(2)),
      fiveYearReplicatedTB: Number(fiveYearReplicatedTB.toFixed(2)),
    },
    cache: {
      dailyActiveReadBytes,
      cacheRAMBytes,
      cacheRAMGB: Number(cacheRAMGB.toFixed(2)),
    },
  };
}

export const PRESETS: Record<string, CapacityInput> = {
  twitter: {
    name: "Twitter / X Timeline (Alex Xu Ch. 2 Reference)",
    dau: 300_000_000,
    readRatio: 10,
    writeRatio: 1,
    avgWritesPerUserPerDay: 2, // 600M tweets per day
    avgWritePayloadBytes: 280, // tweet text + metadata
    avgReadPayloadBytes: 1024, // timeline snippet
    peakMultiplier: 2.0,
    replicationFactor: 3,
    cacheRatio: 0.20,
    cacheHeadroomMultiplier: 1.25,
  },
  chat: {
    name: "WhatsApp / Real-Time Chat System",
    dau: 100_000_000,
    readRatio: 5,
    writeRatio: 1,
    avgWritesPerUserPerDay: 40, // 4B messages/day
    avgWritePayloadBytes: 500, // message text + status
    avgReadPayloadBytes: 500,
    peakMultiplier: 2.5,
    replicationFactor: 3,
    cacheRatio: 0.20,
    cacheHeadroomMultiplier: 1.25,
  },
  video: {
    name: "YouTube / Video Platform Metadata",
    dau: 50_000_000,
    readRatio: 100,
    writeRatio: 1,
    avgWritesPerUserPerDay: 0.05, // 2.5M video uploads/day
    avgWritePayloadBytes: 10_000, // metadata & indexing
    avgReadPayloadBytes: 5_000, // catalog feed
    peakMultiplier: 2.0,
    replicationFactor: 3,
    cacheRatio: 0.20,
    cacheHeadroomMultiplier: 1.25,
  },
};

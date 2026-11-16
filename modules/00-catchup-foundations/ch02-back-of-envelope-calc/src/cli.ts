#!/usr/bin/env node
import { Command } from "commander";
import { calculateCapacity, PRESETS, CapacityInput } from "./calculator.js";

const program = new Command();

program
  .name("estimate")
  .description("Back-of-the-Envelope Capacity Estimator (Alex Xu Chapter 2)")
  .option("-p, --preset <preset>", "Load preset architecture (twitter, chat, video)", "twitter")
  .option("--dau <number>", "Daily Active Users")
  .option("--read-ratio <number>", "Read requests ratio")
  .option("--write-ratio <number>", "Write requests ratio")
  .option("--writes-per-user <number>", "Average writes per user per day")
  .option("--write-bytes <number>", "Average write payload size in bytes")
  .option("--read-bytes <number>", "Average read payload size in bytes")
  .option("--peak-factor <number>", "Peak multiplier (default 2.0)")
  .option("--replication <number>", "Storage replication factor (default 3)")
  .action((options) => {
    let input: CapacityInput;

    if (options.preset && PRESETS[options.preset.toLowerCase()]) {
      input = { ...PRESETS[options.preset.toLowerCase()] };
    } else {
      input = { ...PRESETS.twitter };
    }

    if (options.dau) input.dau = Number(options.dau);
    if (options.readRatio) input.readRatio = Number(options.readRatio);
    if (options.writeRatio) input.writeRatio = Number(options.writeRatio);
    if (options.writesPerUser) input.avgWritesPerUserPerDay = Number(options.writesPerUser);
    if (options.writeBytes) input.avgWritePayloadBytes = Number(options.writeBytes);
    if (options.readBytes) input.avgReadPayloadBytes = Number(options.readBytes);
    if (options.peakFactor) input.peakMultiplier = Number(options.peakFactor);
    if (options.replication) input.replicationFactor = Number(options.replication);

    const report = calculateCapacity(input);

    console.log("\n=======================================================");
    console.log(` SYSTEM DESIGN CAPACITY ESTIMATION: ${report.name.toUpperCase()}`);
    console.log("=======================================================\n");

    console.log(`[Parameters]`);
    console.log(`  - Daily Active Users (DAU)  : ${report.dau.toLocaleString()}`);
    console.log(`  - Read to Write Ratio       : ${input.readRatio} : ${input.writeRatio}`);
    console.log(`  - Writes / User / Day       : ${input.avgWritesPerUserPerDay}`);
    console.log(`  - Write Payload Size        : ${input.avgWritePayloadBytes} bytes`);
    console.log(`  - Read Payload Size         : ${input.avgReadPayloadBytes} bytes`);
    console.log(`  - Peak Factor               : ${input.peakMultiplier ?? 2.0}×`);
    console.log(`  - Replication Factor        : ${input.replicationFactor ?? 3}×`);
    console.log("");

    console.log(`[1. Throughput & QPS]`);
    console.log(`  - Write QPS                 : ${report.qps.writeQps.toLocaleString()} req/s`);
    console.log(`  - Peak Write QPS            : ${report.qps.peakWriteQps.toLocaleString()} req/s`);
    console.log(`  - Read QPS                  : ${report.qps.readQps.toLocaleString()} req/s`);
    console.log(`  - Peak Read QPS             : ${report.qps.peakReadQps.toLocaleString()} req/s`);
    console.log(`  - Total QPS (Avg)           : ${report.qps.totalQps.toLocaleString()} req/s`);
    console.log(`  - Total QPS (Peak)          : ${report.qps.peakTotalQps.toLocaleString()} req/s`);
    console.log("");

    console.log(`[2. Bandwidth Consumption]`);
    console.log(`  - Write Bandwidth           : ${report.bandwidth.writeMBPerSec} MB/s (${report.bandwidth.writeGbps} Gbps)`);
    console.log(`  - Read Bandwidth            : ${report.bandwidth.readMBPerSec} MB/s (${report.bandwidth.readGbps} Gbps)`);
    console.log(`  - Total Network Ingress/Egr : ${report.bandwidth.totalMBPerSec} MB/s (${report.bandwidth.totalGbps} Gbps)`);
    console.log("");

    console.log(`[3. Storage Requirements]`);
    console.log(`  - Daily Raw Ingestion       : ${report.storage.dailyGB} GB/day`);
    console.log(`  - Annual Storage (1 Year)   : ${report.storage.annualTB} TB`);
    console.log(`  - 5-Year Storage (Raw)      : ${report.storage.fiveYearTB} TB`);
    console.log(`  - 5-Year Storage (3× Repl)  : ${report.storage.fiveYearReplicatedTB} TB`);
    console.log("");

    console.log(`[4. Cache Memory Sizing (80-20 Pareto Rule)]`);
    console.log(`  - Daily Read Volume         : ${(report.cache.dailyActiveReadBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`);
    console.log(`  - 20% Hot Working Set + 25% : ${report.cache.cacheRAMGB} GB RAM`);
    console.log("");
    console.log("=======================================================\n");
  });

program.parse(process.argv);

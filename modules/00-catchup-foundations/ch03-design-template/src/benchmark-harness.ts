import autocannon, { Options, Result } from "autocannon";
import { logger } from "@system-design/shared";

export interface BenchmarkThresholds {
  maxP99LatencyMs?: number;
  minThroughputReqSec?: number;
  maxErrorRatePercent?: number;
}

export interface BenchmarkReport {
  totalRequests: number;
  durationSeconds: number;
  throughputAvg: number;
  latencyP50: number;
  latencyP90: number;
  latencyP99: number;
  latencyP999: number;
  errorsTotal: number;
  errorRatePercent: number;
  passedThresholds: boolean;
}

/**
 * Reusable Autocannon Benchmark Runner for System Design Empiricism
 */
export async function runLoadTest(
  options: Options,
  thresholds: BenchmarkThresholds = {}
): Promise<BenchmarkReport> {
  const {
    maxP99LatencyMs = 100,
    minThroughputReqSec = 500,
    maxErrorRatePercent = 0.5,
  } = thresholds;

  logger.info({ url: options.url, connections: options.connections }, "[Benchmark] Starting load test run...");

  const result: Result = await autocannon(options);

  const totalErrors = result.errors + result.timeouts + result.non2xx;
  const errorRatePercent = result.requests.total > 0 ? (totalErrors / result.requests.total) * 100 : 0;

  const passedLatency = result.latency.p99 <= maxP99LatencyMs;
  const passedThroughput = result.requests.average >= minThroughputReqSec;
  const passedErrors = errorRatePercent <= maxErrorRatePercent;
  const passedThresholds = passedLatency && passedThroughput && passedErrors;

  const report: BenchmarkReport = {
    totalRequests: result.requests.total,
    durationSeconds: result.duration,
    throughputAvg: Math.round(result.requests.average),
    latencyP50: result.latency.p50,
    latencyP90: result.latency.p90,
    latencyP99: result.latency.p99,
    latencyP999: result.latency.p99_9 ?? result.latency.p99,
    errorsTotal: totalErrors,
    errorRatePercent: Number(errorRatePercent.toFixed(2)),
    passedThresholds,
  };

  logger.info(
    {
      throughput: `${report.throughputAvg} req/s`,
      p99: `${report.latencyP99} ms`,
      errors: `${report.errorRatePercent}%`,
      passed: passedThresholds,
    },
    "[Benchmark] Run complete."
  );

  return report;
}

export * from "./benchmark-harness.js";

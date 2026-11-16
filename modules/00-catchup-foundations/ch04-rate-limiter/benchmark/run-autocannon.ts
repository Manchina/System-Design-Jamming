import autocannon from "autocannon";
import { buildServer } from "../src/server.js";

async function runBenchmark() {
  const TEST_LIMIT = 100;
  const WINDOW_MS = 10_000; // 10 seconds

  console.log("\n=======================================================");
  console.log(" AUTOCANNON ATOMIC RATE LIMITER RACE-CONDITION HARNESS ");
  console.log("=======================================================\n");

  const { app, redis } = await buildServer({
    limit: TEST_LIMIT,
    windowMs: WINDOW_MS,
    algorithm: "sliding-window",
  });

  try {
    await redis.ping();
  } catch {
    console.error("\n[Error] Redis is not reachable at localhost:6379.");
    console.error("Please launch Docker and start infrastructure first:");
    console.error("   npm run docker:up\n");
    await app.close();
    process.exit(1);
  }

  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  console.log(`[Setup] Ephemeral test server active on ${address}`);
  console.log(`[Setup] Configured limit: ${TEST_LIMIT} requests per ${WINDOW_MS / 1000}s`);

  // Flush rate limiter test keys
  const keys = await redis.keys("ratelimit:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  console.log("[Setup] Redis rate-limit state flushed clean.\n");

  console.log("[Execution] Firing concurrent burst: 50 connections, 2,000 requests...");

  const result = await autocannon({
    url: `${address}/api/burst-test`,
    connections: 50,
    amount: 2000,
    headers: {
      "x-api-key": "test-client-burst",
    },
  });

  console.log("\n=======================================================");
  console.log(" BENCHMARK RESULTS & EMPIRICAL VERIFICATION ");
  console.log("=======================================================\n");
  console.log(`Total Requests Fired  : ${result.requests.total}`);
  console.log(`2xx (Successes)       : ${result["2xx"]}`);
  console.log(`4xx (Rate Limited)    : ${result["4xx"]}`);
  console.log(`5xx (Errors)          : ${result["5xx"]}`);
  console.log(`Throughput            : ${result.requests.average} req/s`);
  console.log(`p99 Latency           : ${result.latency.p99} ms`);
  console.log("");

  // Assertion check
  const allowedRequests = result["2xx"];
  const rejectedRequests = result["4xx"];

  console.log(`[Verification Assertion]`);
  console.log(`  - Target Max Allowed : ${TEST_LIMIT}`);
  console.log(`  - Actual 2xx Allowed : ${allowedRequests}`);
  console.log(`  - Actual 429 Blocked : ${rejectedRequests}`);

  let passed = true;

  if (allowedRequests !== TEST_LIMIT) {
    console.error(`\n[FAIL] Race condition detected! Expected exactly ${TEST_LIMIT} allowed requests, but ${allowedRequests} passed.`);
    passed = false;
  } else {
    console.log(`\n[PASS] Atomic Lua Script Verified: EXACTLY ${TEST_LIMIT} requests admitted across 50 concurrent connections! Zero race conditions.`);
  }

  if (result["5xx"] > 0) {
    console.error(`[FAIL] Detected ${result["5xx"]} internal server errors.`);
    passed = false;
  }

  await app.close();
  await redis.quit();

  if (!passed) {
    process.exit(1);
  }
}

runBenchmark().catch((err) => {
  console.error("Benchmark execution failed:", err);
  process.exit(1);
});

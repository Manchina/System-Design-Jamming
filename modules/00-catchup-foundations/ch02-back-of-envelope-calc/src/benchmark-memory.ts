/**
 * Memory Footprint Benchmark: 1,000,000 Records
 * Compares Plain V8 Objects vs Compact TypedArrays vs Packed Binary Buffers.
 */

function formatMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function getMemoryUsage(): number {
  if (global.gc) {
    global.gc();
  }
  return process.memoryUsage().heapUsed;
}

const TOTAL_RECORDS = 1_000_000;

console.log("\n=======================================================");
console.log(` V8 MEMORY FOOTPRINT BENCHMARK (${TOTAL_RECORDS.toLocaleString()} RECORDS)`);
console.log("=======================================================\n");

// 1. Plain V8 JavaScript Objects
interface PlainRecord {
  id: number;
  timestamp: number;
  status: number;
  score: number;
}

const memBeforeObj = getMemoryUsage();
const plainObjects: PlainRecord[] = new Array(TOTAL_RECORDS);
for (let i = 0; i < TOTAL_RECORDS; i++) {
  plainObjects[i] = {
    id: i,
    timestamp: 1710000000000 + i,
    status: i % 4,
    score: (i % 100) * 1.5,
  };
}
const memAfterObj = getMemoryUsage();
const plainObjHeap = Math.max(0, memAfterObj - memBeforeObj);
const bytesPerObj = (plainObjHeap / TOTAL_RECORDS).toFixed(1);

console.log(`[Format 1: Plain V8 Objects]`);
console.log(`  - Total Heap Allocated  : ${formatMB(plainObjHeap)}`);
console.log(`  - Overhead per Record   : ~${bytesPerObj} bytes/record`);
console.log("");

// Clean up references to let GC claim memory if possible
plainObjects.length = 0;

// 2. Compact Typed Arrays (Struct-of-Arrays Pattern)
const memBeforeTyped = getMemoryUsage();
const ids = new Uint32Array(TOTAL_RECORDS);
const timestamps = new Float64Array(TOTAL_RECORDS);
const statuses = new Uint8Array(TOTAL_RECORDS);
const scores = new Float32Array(TOTAL_RECORDS);

for (let i = 0; i < TOTAL_RECORDS; i++) {
  ids[i] = i;
  timestamps[i] = 1710000000000 + i;
  statuses[i] = i % 4;
  scores[i] = (i % 100) * 1.5;
}
const memAfterTyped = getMemoryUsage();
const typedHeap = Math.max(0, memAfterTyped - memBeforeTyped);
const bytesPerTyped = (
  (ids.byteLength + timestamps.byteLength + statuses.byteLength + scores.byteLength) /
  TOTAL_RECORDS
).toFixed(1);

console.log(`[Format 2: Compact TypedArrays (Struct-of-Arrays)]`);
console.log(`  - Total Buffer Allocated : ${formatMB(ids.byteLength + timestamps.byteLength + statuses.byteLength + scores.byteLength)}`);
console.log(`  - Heap delta reported   : ${formatMB(typedHeap)}`);
console.log(`  - Size per Record       : exactly ${bytesPerTyped} bytes/record (4 + 8 + 1 + 4 bytes)`);
console.log("");

// 3. Packed Binary Buffer (Array-of-Structs packed sequentially)
// Layout: [uint32 id (4B)] + [float64 timestamp (8B)] + [uint8 status (1B)] + [float32 score (4B)] = 17 Bytes
const RECORD_BYTE_SIZE = 17;
const memBeforeBuffer = getMemoryUsage();
const binaryBuffer = Buffer.allocUnsafe(TOTAL_RECORDS * RECORD_BYTE_SIZE);

for (let i = 0; i < TOTAL_RECORDS; i++) {
  const offset = i * RECORD_BYTE_SIZE;
  binaryBuffer.writeUInt32LE(i, offset);
  binaryBuffer.writeDoubleLE(1710000000000 + i, offset + 4);
  binaryBuffer.writeUInt8(i % 4, offset + 12);
  binaryBuffer.writeFloatLE((i % 100) * 1.5, offset + 13);
}
const memAfterBuffer = getMemoryUsage();
const bufferHeap = Math.max(0, memAfterBuffer - memBeforeBuffer);

console.log(`[Format 3: Packed Binary Buffer (Array-of-Structs)]`);
console.log(`  - Total Buffer Size     : ${formatMB(binaryBuffer.byteLength)}`);
console.log(`  - Size per Record       : exactly ${RECORD_BYTE_SIZE} bytes/record`);
console.log("");

// Summary Comparison Table
console.log("--------------------------------------------------------------------------------");
console.log("| Implementation Format         | Memory Footprint | Size / Record | Efficiency |");
console.log("--------------------------------------------------------------------------------");
console.log(`| 1. Plain V8 JSON Objects      | ${formatMB(plainObjHeap).padEnd(16)} | ~${bytesPerObj.padEnd(10)} B | 1.0× (Baseline) |`);
console.log(`| 2. Struct-of-Arrays (Typed)   | ${formatMB(ids.byteLength + timestamps.byteLength + statuses.byteLength + scores.byteLength).padEnd(16)} | ${bytesPerTyped.padEnd(12)} B | ~${(Number(bytesPerObj) / Number(bytesPerTyped)).toFixed(1)}× less RAM |`);
console.log(`| 3. Packed Binary Buffer       | ${formatMB(binaryBuffer.byteLength).padEnd(16)} | ${String(RECORD_BYTE_SIZE).padEnd(12)} B | ~${(Number(bytesPerObj) / RECORD_BYTE_SIZE).toFixed(1)}× less RAM |`);
console.log("--------------------------------------------------------------------------------\n");

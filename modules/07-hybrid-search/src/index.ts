// Hybrid Search with pgvector & BM25 Reciprocal Rank Fusion stub (Chapter 13)
export function computeRRF(lexicalRank: number, vectorRank: number, k = 60): number {
  return (1 / (k + lexicalRank)) + (1 / (k + vectorRank));
}

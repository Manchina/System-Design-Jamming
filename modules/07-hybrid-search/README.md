# Chapter 13: Hybrid Search Engine (pgvector + BM25 Full-Text)

## Architectural Scope
- Vector embedding storage in PostgreSQL with `vector(1536)` and HNSW cosine distance indexing.
- Lexical full-text indexing via PostgreSQL `tsvector` and GIN index.
- Reciprocal Rank Fusion (RRF) algorithm combining lexical and semantic results:
  `RRF_Score = (1 / (60 + Lexical_Rank)) + (1 / (60 + Vector_Rank))`

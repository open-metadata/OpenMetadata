-- Add per-stage cumulative timing columns to search_index_server_stats so the
-- distributed aggregator can surface where reindex latency is being spent
-- (DB read in Reader, doc-build in Process, OpenSearch bulk in Sink, embeddings
-- in Vector). Stored as BIGINT milliseconds; UI computes avg latency and
-- throughput client-side from totalTimeMs / successRecords.
ALTER TABLE search_index_server_stats
  ADD COLUMN readerTimeMs BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN processTimeMs BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN sinkTimeMs BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN vectorTimeMs BIGINT NOT NULL DEFAULT 0;

-- Add process and vector stage columns to search_index_server_stats table
-- These columns support the 4-stage pipeline model (Reader, Process, Sink, Vector) for search indexing stats

ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS processSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS processFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS processWarnings BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS vectorSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS vectorFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS vectorWarnings BIGINT DEFAULT 0;

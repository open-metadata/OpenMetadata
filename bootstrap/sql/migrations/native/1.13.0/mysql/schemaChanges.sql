-- Add process and vector stage columns to search_index_server_stats table
-- These columns support the 4-stage pipeline model (Reader, Process, Sink, Vector) for search indexing stats

ALTER TABLE search_index_server_stats ADD COLUMN processSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN processFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN processWarnings BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN vectorSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN vectorFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN vectorWarnings BIGINT DEFAULT 0;

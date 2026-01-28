-- Add process and vector stage columns to search_index_server_stats table
-- These columns support the 4-stage pipeline model (Reader, Process, Sink, Vector) for search indexing stats

ALTER TABLE search_index_server_stats ADD COLUMN processSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN processFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN processWarnings BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN vectorSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN vectorFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN vectorWarnings BIGINT DEFAULT 0;

-- Add entityType column to support per-entity stats tracking
-- Stats are now tracked per (jobId, serverId, entityType) instead of (jobId, serverId)
ALTER TABLE search_index_server_stats ADD COLUMN entityType VARCHAR(128) NOT NULL DEFAULT 'unknown';

-- Drop old unique index and create new one with entityType
ALTER TABLE search_index_server_stats DROP INDEX idx_search_index_server_stats_job_server;
CREATE UNIQUE INDEX idx_search_index_server_stats_job_server_entity
    ON search_index_server_stats (jobId, serverId, entityType);

-- Remove deprecated columns (entityBuildFailures is redundant - failures are tracked as processFailed)
-- sinkTotal and sinkWarnings are not needed
ALTER TABLE search_index_server_stats DROP COLUMN entityBuildFailures;
ALTER TABLE search_index_server_stats DROP COLUMN sinkTotal;
ALTER TABLE search_index_server_stats DROP COLUMN sinkWarnings;
ALTER TABLE search_index_server_stats DROP COLUMN processWarnings;

-- Add process and vector stage columns to search_index_server_stats table
-- These columns support the 4-stage pipeline model (Reader, Process, Sink, Vector) for search indexing stats

ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS processSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS processFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS processWarnings BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS vectorSuccess BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS vectorFailed BIGINT DEFAULT 0;
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS vectorWarnings BIGINT DEFAULT 0;

-- Add entityType column to support per-entity stats tracking
-- Stats are now tracked per (jobId, serverId, entityType) instead of (jobId, serverId)
ALTER TABLE search_index_server_stats ADD COLUMN IF NOT EXISTS entityType VARCHAR(128) NOT NULL DEFAULT 'unknown';

-- Drop old unique index and create new one with entityType
DROP INDEX IF EXISTS idx_search_index_server_stats_job_server;
CREATE UNIQUE INDEX IF NOT EXISTS idx_search_index_server_stats_job_server_entity
    ON search_index_server_stats (jobId, serverId, entityType);

-- Remove deprecated columns (entityBuildFailures is redundant - failures are tracked as processFailed)
-- sinkTotal and sinkWarnings are not needed
ALTER TABLE search_index_server_stats DROP COLUMN IF EXISTS entityBuildFailures;
ALTER TABLE search_index_server_stats DROP COLUMN IF EXISTS sinkTotal;
ALTER TABLE search_index_server_stats DROP COLUMN IF EXISTS sinkWarnings;
ALTER TABLE search_index_server_stats DROP COLUMN IF EXISTS processWarnings;

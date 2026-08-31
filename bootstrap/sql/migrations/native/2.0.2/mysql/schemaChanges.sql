-- RDF reindex reliability and blue/green rebuilds - OpenMetadata 2.0.2

-- RDF Index Failures Table
-- Purpose: Store individual failure records for entities that fail during RDF reindexing,
-- so failed records can be inspected and retried instead of silently lost until the next full run.
CREATE TABLE IF NOT EXISTS rdf_index_failures (
    id VARCHAR(36) NOT NULL,
    jobId VARCHAR(36) NOT NULL,
    serverId VARCHAR(256) NOT NULL,
    entityType VARCHAR(256) NOT NULL,
    entityId VARCHAR(36),
    entityFqn VARCHAR(1024),
    failureStage VARCHAR(32) NOT NULL,
    errorMessage LONGTEXT,
    stackTrace LONGTEXT,
    timestamp BIGINT NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_rdf_index_failures_job_id (jobId),
    INDEX idx_rdf_index_failures_job_stage (jobId, failureStage),
    INDEX idx_rdf_index_failures_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Pipeline timing for RDF distributed indexing: the run stats previously recorded only counts,
-- so the UI showed "<1 ms" averages while real throughput was seconds per record. Reader time is
-- the keyset read; sink time is the full RDF write path (translation + storage round trips).
ALTER TABLE rdf_index_partition
    ADD COLUMN readerTimeMs BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN processTimeMs BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN sinkTimeMs BIGINT NOT NULL DEFAULT 0;

-- Blue/green RDF dataset pointer. A full rebuild builds into an idle dataset and then flips this
-- single row, so the served graph is never cleared out from under live queries the way a per-run
-- CLEAR ALL does. Empty table means "use the dataset named in the configured endpoint", which is
-- the pre-blue/green behaviour, so upgrades are inert until an operator opts in.
CREATE TABLE IF NOT EXISTS rdf_active_dataset (
    id VARCHAR(8) NOT NULL,
    datasetName VARCHAR(256) NOT NULL,
    updatedAt BIGINT NOT NULL,
    updatedBy VARCHAR(256),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

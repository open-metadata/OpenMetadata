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
-- the keyset read; process time is translation; sink time is storage round trips.
-- The migration runner deduplicates SQL by text, so each prepared statement needs a unique name.
SET @rdf_reader_time_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'rdf_index_partition'
        AND column_name = 'readerTimeMs'
    ),
    'SELECT 1',
    'ALTER TABLE rdf_index_partition ADD COLUMN readerTimeMs BIGINT NOT NULL DEFAULT 0'
  )
);
PREPARE rdf_reader_time_stmt FROM @rdf_reader_time_ddl;
EXECUTE rdf_reader_time_stmt;
DEALLOCATE PREPARE rdf_reader_time_stmt;

SET @rdf_process_time_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'rdf_index_partition'
        AND column_name = 'processTimeMs'
    ),
    'SELECT 1',
    'ALTER TABLE rdf_index_partition ADD COLUMN processTimeMs BIGINT NOT NULL DEFAULT 0'
  )
);
PREPARE rdf_process_time_stmt FROM @rdf_process_time_ddl;
EXECUTE rdf_process_time_stmt;
DEALLOCATE PREPARE rdf_process_time_stmt;

SET @rdf_sink_time_ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'rdf_index_partition'
        AND column_name = 'sinkTimeMs'
    ),
    'SELECT 1',
    'ALTER TABLE rdf_index_partition ADD COLUMN sinkTimeMs BIGINT NOT NULL DEFAULT 0'
  )
);
PREPARE rdf_sink_time_stmt FROM @rdf_sink_time_ddl;
EXECUTE rdf_sink_time_stmt;
DEALLOCATE PREPARE rdf_sink_time_stmt;

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

-- A separate guard fences rebuild writers without holding the live-routing lock.
CREATE TABLE IF NOT EXISTS rdf_rebuild_write_guard (
    id VARCHAR(32) NOT NULL PRIMARY KEY
);
INSERT IGNORE INTO rdf_rebuild_write_guard (id) VALUES ('active');

CREATE TABLE IF NOT EXISTS rdf_rebuild_state (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    rebuildId VARCHAR(36) NOT NULL,
    buildDataset VARCHAR(256) NOT NULL,
    expiresAt BIGINT NOT NULL,
    journalBytes BIGINT NOT NULL DEFAULT 0,
    journalRecords BIGINT NOT NULL DEFAULT 0,
    failure TEXT
);

CREATE TABLE IF NOT EXISTS rdf_rebuild_journal (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    rebuildId VARCHAR(36) NOT NULL,
    payload LONGTEXT NOT NULL,
    INDEX idx_rdf_rebuild_journal_run (rebuildId, id)
);

-- Live writes survive executor saturation and server restarts. Separate producer and consumer
-- fences preserve commit order without making request threads wait for the triplestore.
CREATE TABLE IF NOT EXISTS rdf_live_write_guard (
    id VARCHAR(32) NOT NULL PRIMARY KEY
) ENGINE=InnoDB;
INSERT IGNORE INTO rdf_live_write_guard (id) VALUES ('enqueue'), ('drain');

CREATE TABLE IF NOT EXISTS rdf_live_write_queue (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    payload LONGTEXT NOT NULL,
    createdAt BIGINT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    nextAttemptAt BIGINT NOT NULL DEFAULT 0,
    lastError TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A rebuild can acknowledge only failures known before it started. Queue failures are tracked
-- by the outstanding work itself and recover automatically after successful replay.
CREATE TABLE IF NOT EXISTS rdf_projection_health (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    failureVersion BIGINT NOT NULL DEFAULT 0,
    repairedVersion BIGINT NOT NULL DEFAULT 0,
    lastError TEXT,
    updatedAt BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
INSERT IGNORE INTO rdf_projection_health (id) VALUES ('active');

-- Exhausted deliveries stop blocking the queue but remain degraded until a covering rebuild.
CREATE TABLE IF NOT EXISTS rdf_live_write_dead_letter (
    id BIGINT NOT NULL PRIMARY KEY,
    payload LONGTEXT NOT NULL,
    createdAt BIGINT NOT NULL,
    attempts INT NOT NULL,
    failedAt BIGINT NOT NULL,
    lastError TEXT NOT NULL,
    failureVersion BIGINT NOT NULL,
    INDEX rdf_live_dead_letter_failure_version (failureVersion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Pipeline alert starting watermark - OpenMetadata 2.0.2

-- Alerts must not fire for pipeline executions that finished before the alert existed (#31782).
-- Stamp the alerting watermark on subscriptions that already have a consumer offset; subscriptions
-- without one are stamped when that row is first created. '$.timestamp' is deliberately untouched:
-- change_event_consumers derives a NOT NULL generated column from it.
UPDATE change_event_consumers
SET json = JSON_SET(json, '$.startingTimestamp', CAST(UNIX_TIMESTAMP(NOW(3)) * 1000 AS UNSIGNED))
WHERE extension = 'eventSubscription.Offset'
  AND JSON_EXTRACT(json, '$.startingTimestamp') IS NULL;

-- Incident Manager grouped incidents - OpenMetadata 2.1.0

-- Index the stateId partition used by the incident grouping endpoint (/testCaseIncidentStatus/incidentGroups)
ALTER TABLE test_case_resolution_status_time_series ADD INDEX idx_test_case_resolution_status_state_id (stateId, timestamp);

-- Serve entityFQNHash-driven access on the incident timeline: the /testCaseIncidentStatus list
-- filters (testCaseFQN scope, testDefinition semi-join) and the incident grouping CTE scope all
-- seek by entityFQNHash; only id-leading and timestamp-leading indexes existed before.
ALTER TABLE test_case_resolution_status_time_series ADD INDEX idx_test_case_resolution_status_fqn_ts (entityFQNHash, timestamp);

-- test_case predates the PRIMARY KEY(id) convention of newer entity tables and had no id index,
-- so entity_relationship joins on toId = test_case.id (testDefinition incident filter) and
-- id-based lookups fall back to full scans.
ALTER TABLE test_case ADD INDEX idx_test_case_id (id);

-- The incident list's assignee filter compares the generated assignee column, which had no
-- index and full-scanned the timeline at scale.
ALTER TABLE test_case_resolution_status_time_series ADD INDEX idx_test_case_resolution_status_assignee (assignee, timestamp);

-- Incident summary table: one row per incident (stateId chain), maintained at write time so
-- state-shaped reads (incidentGroups) are O(open incidents) instead of folding full history.
-- Column names deliberately mirror the time-series table so ListFilter conditions apply verbatim.
CREATE TABLE IF NOT EXISTS test_case_incident (
    stateId varchar(36) NOT NULL,
    entityFQNHash varchar(768) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    testCaseResolutionStatusType varchar(36) NOT NULL,
    assignee varchar(256) DEFAULT NULL,
    severity varchar(36) DEFAULT NULL,
    createdAt bigint unsigned NOT NULL,
    updatedAt bigint unsigned NOT NULL,
    latestRecordId varchar(36) NOT NULL,
    PRIMARY KEY (stateId),
    INDEX idx_tci_status_fqn (testCaseResolutionStatusType, entityFQNHash),
    INDEX idx_tci_fqn (entityFQNHash),
    INDEX idx_tci_assignee (assignee, testCaseResolutionStatusType),
    INDEX idx_tci_updated (updatedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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

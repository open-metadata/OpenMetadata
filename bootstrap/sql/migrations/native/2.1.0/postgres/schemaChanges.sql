-- Incident Manager grouped incidents - OpenMetadata 2.1.0

-- Index the stateId partition used by the incident grouping endpoint (/testCaseIncidentStatus/incidentGroups)
CREATE INDEX IF NOT EXISTS idx_test_case_resolution_status_state_id ON test_case_resolution_status_time_series (stateId, timestamp);

-- Serve entityFQNHash-driven access on the incident timeline: the /testCaseIncidentStatus list
-- filters (testCaseFQN scope, testDefinition semi-join) and the incident grouping CTE scope all
-- seek by entityFQNHash; only id-leading and timestamp-leading indexes existed before.
CREATE INDEX IF NOT EXISTS idx_test_case_resolution_status_fqn_ts ON test_case_resolution_status_time_series (entityFQNHash, timestamp);

-- test_case predates the PRIMARY KEY(id) convention of newer entity tables and had no id index,
-- so entity_relationship joins on toId = test_case.id (testDefinition incident filter) and
-- id-based lookups fall back to full scans.
CREATE INDEX IF NOT EXISTS idx_test_case_id ON test_case (id);

-- The incident list's assignee filter compares the generated assignee column, which had no
-- index and full-scanned the timeline at scale.
CREATE INDEX IF NOT EXISTS idx_test_case_resolution_status_assignee ON test_case_resolution_status_time_series (assignee, timestamp);

-- Incident summary table: one row per incident (stateId chain), maintained at write time so
-- state-shaped reads (incidentGroups) are O(open incidents) instead of folding full history.
-- Column names deliberately mirror the time-series table so ListFilter conditions apply verbatim.
CREATE TABLE IF NOT EXISTS test_case_incident (
    stateId varchar(36) NOT NULL,
    entityFQNHash varchar(768) NOT NULL,
    testCaseResolutionStatusType varchar(36) NOT NULL,
    assignee varchar(256) DEFAULT NULL,
    severity varchar(36) DEFAULT NULL,
    createdAt bigint NOT NULL,
    updatedAt bigint NOT NULL,
    latestRecordId varchar(36) NOT NULL,
    PRIMARY KEY (stateId)
);
CREATE INDEX IF NOT EXISTS idx_tci_status_fqn ON test_case_incident (testCaseResolutionStatusType, entityFQNHash);
CREATE INDEX IF NOT EXISTS idx_tci_fqn ON test_case_incident (entityFQNHash);
CREATE INDEX IF NOT EXISTS idx_tci_assignee ON test_case_incident (assignee, testCaseResolutionStatusType);
CREATE INDEX IF NOT EXISTS idx_tci_updated ON test_case_incident (updatedAt);

-- Index the FQN-hash prefix scan behind the table hard-delete profiler purge (issue #27041).
--
-- TableRepository.entitySpecificCleanup purges a hard-deleted table's column profiles through
-- ProfilerDataTimeSeriesDAO before the table can be recreated. The purge matches
--   entityFQNHash LIKE '<table hash>.%'
-- because column profiles are keyed by the *column* FQN, not the table FQN. The only persistent
-- index with entityFQNHash leading is the 1.1.5 unique constraint
-- (entityFQNHash, extension, operation, timestamp); it uses the default operator class and the
-- column inherits the database default collation (en_US.UTF-8 on managed Postgres / RDS), neither
-- of which qualifies the planner to use it for LIKE 'prefix%'. The 1.9.9 migration did create
-- idx_pdts_entityFQNHash_prefix, but that was a migration-time helper and the same script drops it
-- again, so nothing persistent covers this predicate today.
--
-- Without this index every table hard delete costs at least one sequential scan of
-- profiler_data_time_series, and a recursive service delete costs one per table. Measured on
-- postgres:15 (lc_collate=en_US.utf8) with 300k rows / 211 MB, using the exact statement the DAO
-- issues (JDBC binds the prefix as text):
--   before: Parallel Seq Scan, 24.174 ms, 11112 buffers   (terminal batch, prefix matches nothing)
--   after : Index Scan,         0.056 ms,     3 buffers
--   before: Seq Scan,          16.579 ms,  3701 buffers   (first batch, prefix matches 3000 rows)
--   after : Bitmap Heap Scan,   8.647 ms,  1006 buffers
-- Index size 2776 kB against a 211 MB table.
--
-- Why text_pattern_ops and not varchar_pattern_ops:
-- entityFQNHash is VARCHAR(768), so varchar_pattern_ops is the type-matched choice on paper. In
-- practice the planner normalises `varchar LIKE text` — which is what every JDBC setString bind
-- produces — by casting the column, giving `(entityfqnhash)::text ~~ ...`. text_pattern_ops matches
-- that cast expression on every version; the 1.13.0 fqnHash pass documents an environment where
-- varchar_pattern_ops was silently unused and the table seq-scanned. This file follows the same
-- opclass as the idx_*_fqnhash_pattern family for that reason.
--
-- Built CONCURRENTLY so the migration takes no write lock, matching the 1.11.0 idx_tag_usage_* and
-- 1.13.0 idx_*_fqnhash_pattern pattern. Each statement runs outside an implicit transaction, which
-- the native migration runner supports.
--
-- OPERATOR RUNBOOK — interrupted CONCURRENTLY builds.
-- An interrupted CREATE INDEX CONCURRENTLY leaves an INVALID index behind, and `IF NOT EXISTS`
-- would then no-op against it forever. Detect and remediate:
--   SELECT c.relname FROM pg_class c
--    JOIN pg_index i ON i.indexrelid = c.oid
--    WHERE NOT i.indisvalid
--      AND c.relname = 'idx_profiler_data_time_series_fqnhash_pattern';
--   DROP INDEX CONCURRENTLY idx_profiler_data_time_series_fqnhash_pattern;
--   DELETE FROM server_migration_sql_logs
--    WHERE version = '2.1.0'
--      AND sqlstatement LIKE '%idx\_profiler\_data\_time\_series\_fqnhash\_pattern%' ESCAPE '\';
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiler_data_time_series_fqnhash_pattern
    ON profiler_data_time_series (entityFQNHash text_pattern_ops);

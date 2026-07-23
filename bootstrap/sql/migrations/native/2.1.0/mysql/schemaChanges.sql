-- Incident Manager grouped incidents - OpenMetadata 2.1.0
-- MySQL has no `ADD INDEX IF NOT EXISTS`, and environments that ran pre-release builds may
-- already carry these indexes, so each ADD INDEX is guarded via information_schema (mirrors
-- the approvedById guard in 2.0.0).

-- Index the stateId partition used by the incident grouping endpoint (/testCaseIncidentStatus/incidentGroups)
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'test_case_resolution_status_time_series'
        AND index_name = 'idx_test_case_resolution_status_state_id'
    ),
    'SELECT 1',
    'ALTER TABLE test_case_resolution_status_time_series ADD INDEX idx_test_case_resolution_status_state_id (stateId, timestamp)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Serve entityFQNHash-driven access on the incident timeline: the /testCaseIncidentStatus list
-- filters (testCaseFQN scope, testDefinition semi-join) and the incident grouping CTE scope all
-- seek by entityFQNHash; only id-leading and timestamp-leading indexes existed before.
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'test_case_resolution_status_time_series'
        AND index_name = 'idx_test_case_resolution_status_fqn_ts'
    ),
    'SELECT 1',
    'ALTER TABLE test_case_resolution_status_time_series ADD INDEX idx_test_case_resolution_status_fqn_ts (entityFQNHash, timestamp)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- test_case predates the PRIMARY KEY(id) convention of newer entity tables and had no id index,
-- so entity_relationship joins on toId = test_case.id (testDefinition incident filter) and
-- id-based lookups fall back to full scans.
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'test_case'
        AND index_name = 'idx_test_case_id'
    ),
    'SELECT 1',
    'ALTER TABLE test_case ADD INDEX idx_test_case_id (id)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- The incident list's assignee filter compares the generated assignee column, which had no
-- index and full-scanned the timeline at scale.
SET @ddl = (
  SELECT IF(
    EXISTS (
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'test_case_resolution_status_time_series'
        AND index_name = 'idx_test_case_resolution_status_assignee'
    ),
    'SELECT 1',
    'ALTER TABLE test_case_resolution_status_time_series ADD INDEX idx_test_case_resolution_status_assignee (assignee, timestamp)'
  )
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

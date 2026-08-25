-- Perf: UsageDAO.computePercentile runs four correlated COUNT(*) subqueries that each
-- filter entity_usage on (entityType, usageDate). The only existing index is
-- UNIQUE (id, usageDate), which is unusable for that predicate, so every run sequential-scans
-- the table once per subquery. A composite (entityType, usageDate) index turns the
-- percentile subqueries into range scans.
CREATE INDEX IF NOT EXISTS idx_entity_usage_entitytype_usagedate
    ON entity_usage (entityType, usageDate);

-- Correctness: migration 1.6.3 defined the Postgres isBot generated column as
-- (json ->> 'deleted')::boolean instead of (json ->> 'isBot'), so on Postgres isBot has
-- always mirrored `deleted` rather than the real bot flag. countDailyActiveUsers (and any
-- isBot column filter) was therefore wrong on Postgres. Postgres cannot alter a generated
-- column's expression in place, so backfill any rows missing $.isBot, drop the column
-- (this also drops idx_isBot) and recreate it reading the correct path.
-- Operational note: ADD COLUMN ... STORED rewrites the whole user_entity table and holds an
-- ACCESS EXCLUSIVE lock for its duration, and the backfill UPDATE below also scans the full
-- table. On deployments with a very large user_entity, run this migration in a maintenance
-- window; runtime scales with row count (typically seconds, but minutes for millions of users).
-- The change is one-time, idempotent, and Postgres-only (MySQL 1.6.3 was already correct).
UPDATE user_entity SET json = jsonb_set(json, '{isBot}', 'false'::jsonb, true)
    WHERE (json ->> 'isBot') IS NULL;
ALTER TABLE user_entity DROP COLUMN IF EXISTS isBot;
ALTER TABLE user_entity
    ADD COLUMN isBot BOOLEAN GENERATED ALWAYS AS ((json ->> 'isBot')::boolean) STORED NOT NULL;
CREATE INDEX IF NOT EXISTS idx_isBot ON user_entity (isBot);
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

-- Pipeline-backed lineage is the only relationship lookup whose selective identifier lives in JSON.
-- The partial index avoids write amplification for relationships that have no pipeline metadata.
CREATE INDEX IF NOT EXISTS idx_entity_relationship_pipeline_relation
ON entity_relationship ((json->'pipeline'->>'id'), relation)
WHERE (json->'pipeline'->>'id') IS NOT NULL;

-- Switch Oracle services to python-oracledb's native SQLAlchemy dialect.
UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb, '{connection,config,scheme}', '"oracle+oracledb"')
WHERE serviceType = 'Oracle'
  AND json #>> '{connection,config,scheme}' = 'oracle+cx_oracle';

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

-- Metric hierarchy is stored as CONTAINS rows in entity_relationship. Metric Group
-- membership is stored as HAS relationships so deleting a group leaves metrics intact.
CREATE TABLE IF NOT EXISTS metric_group_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    fqnHash VARCHAR(768) DEFAULT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

CREATE INDEX IF NOT EXISTS metric_group_entity_name_index ON metric_group_entity (name);
CREATE INDEX IF NOT EXISTS idx_metric_group_entity_deleted_name_id ON metric_group_entity (deleted, name, id);

-- A Metric can belong to only one Metric Group while every other HAS relationship remains
-- unconstrained by this partial index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_metric_group_single_membership
    ON entity_relationship (toId)
    WHERE fromEntity = 'metricGroup' AND toEntity = 'metric' AND relation = 10;

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

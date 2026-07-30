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

-- Services overview endpoint (/v1/services/overview) - OpenMetadata 2.1.0

-- The (deleted, name) composite that lets `WHERE deleted = FALSE ORDER BY name, id` be served
-- index-only. Nine service tables got it in 1.8.2; these four were added later and were missed,
-- so the overview endpoint's per-type key scan would full-scan them.
CREATE INDEX idx_security_service_entity_deleted_name ON security_service_entity(deleted, name);
CREATE INDEX idx_drive_service_entity_deleted_name ON drive_service_entity(deleted, name);
CREATE INDEX idx_llm_service_entity_deleted_name ON llm_service_entity(deleted, name);
CREATE INDEX idx_mcp_service_entity_deleted_name ON mcp_service_entity(deleted, name);

-- The overview endpoint derives both the per-entity-type total and the per-connector breakdown
-- from one `GROUP BY serviceType` per service table. Without a (deleted, serviceType) composite
-- that grouping reads the table; with it the aggregate is index-only.
CREATE INDEX idx_dbservice_entity_deleted_service_type ON dbservice_entity(deleted, serviceType);
CREATE INDEX idx_dashboard_service_entity_deleted_service_type ON dashboard_service_entity(deleted, serviceType);
CREATE INDEX idx_messaging_service_entity_deleted_service_type ON messaging_service_entity(deleted, serviceType);
CREATE INDEX idx_metadata_service_entity_deleted_service_type ON metadata_service_entity(deleted, serviceType);
CREATE INDEX idx_mlmodel_service_entity_deleted_service_type ON mlmodel_service_entity(deleted, serviceType);
CREATE INDEX idx_pipeline_service_entity_deleted_service_type ON pipeline_service_entity(deleted, serviceType);
CREATE INDEX idx_search_service_entity_deleted_service_type ON search_service_entity(deleted, serviceType);
CREATE INDEX idx_storage_service_entity_deleted_service_type ON storage_service_entity(deleted, serviceType);
CREATE INDEX idx_api_service_entity_deleted_service_type ON api_service_entity(deleted, serviceType);
CREATE INDEX idx_security_service_entity_deleted_service_type ON security_service_entity(deleted, serviceType);
CREATE INDEX idx_drive_service_entity_deleted_service_type ON drive_service_entity(deleted, serviceType);
CREATE INDEX idx_llm_service_entity_deleted_service_type ON llm_service_entity(deleted, serviceType);
CREATE INDEX idx_mcp_service_entity_deleted_service_type ON mcp_service_entity(deleted, serviceType);

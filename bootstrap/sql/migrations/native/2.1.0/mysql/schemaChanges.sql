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

-- DAR duplicate protection: enforce "one active Data Access Request per (creator, target
-- entity)" at the DB layer. The application already runs a SELECT-then-INSERT check
-- (validateNoDuplicateActiveDataAccessRequest), but concurrent creates read null from the
-- SELECT and both INSERT succeed — a classic TOCTOU (report H8).
--
-- MySQL has no partial indexes, so we compute a virtual generated column that is non-null
-- only for active DARs and unique-index that. MySQL treats multiple NULLs as distinct, so
-- terminal rows do not collide. No pre-cleanup step needed: DAR ships in 2.0.0 unreleased,
-- so no live databases carry pre-existing duplicate active-DAR rows.
ALTER TABLE task_entity
    ADD COLUMN activeDarCreatorTargetKey VARCHAR(512)
        GENERATED ALWAYS AS (
            CASE
                WHEN JSON_UNQUOTE(JSON_EXTRACT(json, '$.type')) = 'DataAccessRequest'
                 AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.status'))
                     IN ('Open', 'Approved', 'Granted', 'InProgress', 'ManualRevoke', 'Pending')
                THEN CONCAT(
                    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.createdById')), ''),
                    ':',
                    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(json, '$.aboutFqnHash')), '')
                )
                ELSE NULL
            END
        ) STORED,
    ADD UNIQUE INDEX uk_task_active_dar_creator_target (activeDarCreatorTargetKey);

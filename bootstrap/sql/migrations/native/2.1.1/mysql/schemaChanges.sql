-- Open periods are a compact projection of incident history, retained with their incident.
CREATE TABLE IF NOT EXISTS test_case_incident_open_interval (
    stateId varchar(36) NOT NULL,
    openedAt bigint unsigned NOT NULL,
    closedAt bigint unsigned DEFAULT NULL,
    PRIMARY KEY (stateId, openedAt),
    CONSTRAINT fk_tcioi_incident FOREIGN KEY (stateId)
        REFERENCES test_case_incident (stateId) ON DELETE CASCADE,
    CONSTRAINT chk_tcioi_bounds CHECK (closedAt IS NULL OR closedAt > openedAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE test_case ADD COLUMN incidentTableFqn VARCHAR(512)
    GENERATED ALWAYS AS (TRIM(TRAILING '>' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(json, '$.entityLink')), '::', 3), '::', -1))) VIRTUAL;

-- ASCII hashes plus the full UTF-8 key fit InnoDB's 3072-byte index limit.
CREATE INDEX idx_test_case_incident_grouping ON test_case (fqnHash, deleted, id, incidentTableFqn);

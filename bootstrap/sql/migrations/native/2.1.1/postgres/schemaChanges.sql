-- Open periods are a compact projection of incident history, retained with their incident.
CREATE TABLE IF NOT EXISTS test_case_incident_open_interval (
    stateId varchar(36) NOT NULL,
    openedAt bigint NOT NULL,
    closedAt bigint DEFAULT NULL,
    PRIMARY KEY (stateId, openedAt),
    CONSTRAINT fk_tcioi_incident FOREIGN KEY (stateId)
        REFERENCES test_case_incident (stateId) ON DELETE CASCADE,
    CONSTRAINT chk_tcioi_bounds CHECK (closedAt IS NULL OR closedAt > openedAt)
);

ALTER TABLE test_case
    ALTER COLUMN entityFQN TYPE TEXT,
    ALTER COLUMN entityLink TYPE TEXT;

ALTER TABLE test_case ADD COLUMN IF NOT EXISTS incidentTableFqn VARCHAR(3072)
    GENERATED ALWAYS AS (TRIM(TRAILING '>' FROM SPLIT_PART(json->>'entityLink', '::', 3))) STORED;

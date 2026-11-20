ALTER TABLE test_case ADD COLUMN IF NOT EXISTS incidentTableFqn VARCHAR(512)
    GENERATED ALWAYS AS (TRIM(TRAILING '>' FROM SPLIT_PART(json->>'entityLink', '::', 3))) STORED;
-- Exclude the potentially wide UTF-8 FQN from PostgreSQL's smaller index-tuple limit.
CREATE INDEX IF NOT EXISTS idx_test_case_incident_grouping ON test_case (fqnHash) INCLUDE (deleted, id);

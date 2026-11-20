-- The generated key keeps every write path synchronized without privileged triggers.
SET @incident_group_column_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'test_case' AND column_name = 'incidentTableFqn'
);
SET @incident_group_column_ddl = IF(@incident_group_column_exists = 0,
    'ALTER TABLE test_case ADD COLUMN incidentTableFqn VARCHAR(512) GENERATED ALWAYS AS (TRIM(TRAILING ''>'' FROM SUBSTRING_INDEX(SUBSTRING_INDEX(JSON_UNQUOTE(JSON_EXTRACT(json, ''$.entityLink'')), ''::'', 3), ''::'', -1))) VIRTUAL',
    'SELECT 1');
PREPARE incident_group_column_stmt FROM @incident_group_column_ddl;
EXECUTE incident_group_column_stmt;
DEALLOCATE PREPARE incident_group_column_stmt;

-- ASCII hashes plus the full UTF-8 key fit InnoDB's 3072-byte index limit.
SET @incident_group_index_exists = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE() AND table_name = 'test_case' AND index_name = 'idx_test_case_incident_grouping'
);
SET @incident_group_index_ddl = IF(@incident_group_index_exists = 0,
    'CREATE INDEX idx_test_case_incident_grouping ON test_case (fqnHash, deleted, id, incidentTableFqn)',
    'SELECT 1');
PREPARE incident_group_index_stmt FROM @incident_group_index_ddl;
EXECUTE incident_group_index_stmt;
DEALLOCATE PREPARE incident_group_index_stmt;

-- Optimize index creation with faster settings
SET SESSION sort_buffer_size = 256 * 1024 * 1024;  -- 256MB for faster sorting
SET SESSION myisam_sort_buffer_size = 256 * 1024 * 1024;  -- For index creation
SET SESSION read_buffer_size = 8 * 1024 * 1024;  -- 8MB read buffer

-- Create only essential indexes first
-- Skip the full entityFQNHash index since we have the prefix index
CREATE INDEX idx_pdts_extension ON profiler_data_time_series(extension);
CREATE INDEX idx_te_fqnHash ON table_entity(fqnHash);

-- Add prefix index (more efficient than full index for our use case)
CREATE INDEX idx_pdts_entityFQNHash_prefix ON profiler_data_time_series(entityFQNHash(132));


ANALYZE TABLE profiler_data_time_series;
ANALYZE TABLE table_entity;

-- Migrate table profiles (direct match)
UPDATE profiler_data_time_series pdts
INNER JOIN table_entity te ON pdts.entityFQNHash = te.fqnHash
SET pdts.json = JSON_OBJECT(
    'id', UUID(),
    'entityReference', JSON_OBJECT(
        'id', te.json -> '$.id',
        'type', 'table',
        'fullyQualifiedName', te.json -> '$.fullyQualifiedName',
        'name', te.name
    ),
    'timestamp', pdts.timestamp,
    'profileData', pdts.json,
    'profileType', 'table'
)
WHERE pdts.extension = 'table.tableProfile';

-- Migrate system profiles (direct match)
UPDATE profiler_data_time_series pdts
INNER JOIN table_entity te ON pdts.entityFQNHash = te.fqnHash
SET pdts.json = JSON_OBJECT(
    'id', UUID(),
    'entityReference', JSON_OBJECT(
        'id', te.json -> '$.id',
        'type', 'table',
        'fullyQualifiedName', te.json -> '$.fullyQualifiedName',
        'name', te.name
    ),
    'timestamp', pdts.timestamp,
    'profileData', pdts.json,
    'profileType', 'system'
)
WHERE pdts.extension = 'table.systemProfile';

-- Step 1: Add a temporary column to store the table hash
ALTER TABLE profiler_data_time_series ADD COLUMN temp_table_hash VARCHAR(132);
-- Step 2: Pre-compute the table hash for column profiles (one-time cost)
UPDATE profiler_data_time_series
SET temp_table_hash = SUBSTRING_INDEX(entityFQNHash, '.', 4)
WHERE extension = 'table.columnProfile'
  AND CHAR_LENGTH(entityFQNHash) - CHAR_LENGTH(REPLACE(entityFQNHash, '.', '')) >= 4;

CREATE INDEX idx_temp_table_hash ON profiler_data_time_series(temp_table_hash);

UPDATE profiler_data_time_series pdts
INNER JOIN table_entity te ON pdts.temp_table_hash = te.fqnHash
SET pdts.json = JSON_OBJECT(
    'id', UUID(),
    'entityReference', JSON_OBJECT(
        'id', te.json -> '$.id',
        'type', 'table',
        'fullyQualifiedName', te.json -> '$.fullyQualifiedName',
        'name', te.name
    ),
    'timestamp', pdts.timestamp,
    'profileData', pdts.json,
    'profileType', 'column'
)
WHERE pdts.extension = 'table.columnProfile'
  AND pdts.temp_table_hash IS NOT NULL;

-- Step 5: Clean up
DROP INDEX idx_temp_table_hash ON profiler_data_time_series;
ALTER TABLE profiler_data_time_series DROP COLUMN temp_table_hash;

-- Drop temporary indexes after migration
DROP INDEX idx_pdts_entityFQNHash_prefix ON profiler_data_time_series;
DROP INDEX idx_pdts_extension ON profiler_data_time_series;
DROP INDEX idx_te_fqnHash ON table_entity;

-- Reset session variables
SET SESSION sort_buffer_size = DEFAULT;
SET SESSION myisam_sort_buffer_size = DEFAULT;
SET SESSION read_buffer_size = DEFAULT;

-- Analyze tables after migration for updated statistics
ANALYZE TABLE profiler_data_time_series;
ANALYZE TABLE table_entity;

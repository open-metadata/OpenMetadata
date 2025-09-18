-- Create indexes for better performance
CREATE INDEX idx_pdts_entityFQNHash ON profiler_data_time_series(entityFQNHash);
CREATE INDEX idx_pdts_extension ON profiler_data_time_series(extension);
CREATE INDEX idx_te_fqnHash ON table_entity(fqnHash);

-- Add prefix index for LIKE queries (service.database.schema.table = 4 MD5 hashes + 3 dots = 132 chars)
CREATE INDEX idx_pdts_entityFQNHash_prefix ON profiler_data_time_series(entityFQNHash(132));

-- Add composite index for better join performance
CREATE INDEX idx_pdts_composite ON profiler_data_time_series(extension, entityFQNHash);

-- Analyze tables for query optimizer (MySQL 8.0+)
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

-- Migrate column profiles using the most reliable approach
-- Step 1: Add a temporary column to store the table hash
-- Note: This might fail if column already exists from a previous interrupted migration
-- In that case, the migration can continue safely
ALTER TABLE profiler_data_time_series ADD COLUMN temp_table_hash VARCHAR(768);

-- Step 2: Extract and store the table hash for column profiles
UPDATE profiler_data_time_series
SET temp_table_hash = SUBSTRING_INDEX(entityFQNHash, '.', 4)
WHERE extension = 'table.columnProfile'
  AND temp_table_hash IS NULL;

-- Step 3: Create index on the temporary column for fast joins
CREATE INDEX idx_temp_table_hash ON profiler_data_time_series(temp_table_hash);

-- Step 4: Now do the update with a simple indexed join (MUCH faster)
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
WHERE pdts.extension = 'table.columnProfile';

-- Step 5: Clean up
DROP INDEX idx_temp_table_hash ON profiler_data_time_series;
ALTER TABLE profiler_data_time_series DROP COLUMN temp_table_hash;

-- Drop temporary indexes after migration
DROP INDEX idx_pdts_entityFQNHash ON profiler_data_time_series;
DROP INDEX idx_pdts_entityFQNHash_prefix ON profiler_data_time_series;
DROP INDEX idx_pdts_extension ON profiler_data_time_series;
DROP INDEX idx_te_fqnHash ON table_entity;
DROP INDEX idx_pdts_composite ON profiler_data_time_series;

-- Analyze tables after migration for updated statistics
ANALYZE TABLE profiler_data_time_series;
ANALYZE TABLE table_entity;

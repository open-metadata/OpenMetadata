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

-- Migrate column profiles using optimized approach similar to PostgreSQL
-- Step 1: Create MEMORY table for ultra-fast mapping (like PostgreSQL UNLOGGED)
CREATE TEMPORARY TABLE IF NOT EXISTS column_to_table_mapping (
    column_hash VARCHAR(768) PRIMARY KEY,
    table_hash VARCHAR(132),
    table_id VARCHAR(100),
    table_fqn TEXT,
    table_name VARCHAR(256),
    INDEX idx_table_hash (table_hash)
) ENGINE=MEMORY MAX_ROWS=2000000;

-- Step 2: Populate mapping with pre-joined data (single scan of table_entity)
INSERT INTO column_to_table_mapping (column_hash, table_hash, table_id, table_fqn, table_name)
SELECT DISTINCT
    pdts.entityFQNHash as column_hash,
    SUBSTRING_INDEX(pdts.entityFQNHash, '.', 4) as table_hash,
    te.json -> '$.id' as table_id,
    te.json -> '$.fullyQualifiedName' as table_fqn,
    te.name as table_name
FROM profiler_data_time_series pdts
STRAIGHT_JOIN table_entity te ON SUBSTRING_INDEX(pdts.entityFQNHash, '.', 4) = te.fqnHash
WHERE pdts.extension = 'table.columnProfile';

-- Step 3: Update using the pre-computed mapping (no more joins needed!)
UPDATE profiler_data_time_series pdts
INNER JOIN column_to_table_mapping ctm ON pdts.entityFQNHash = ctm.column_hash
SET pdts.json = JSON_OBJECT(
    'id', UUID(),
    'entityReference', JSON_OBJECT(
        'id', ctm.table_id,
        'type', 'table',
        'fullyQualifiedName', ctm.table_fqn,
        'name', ctm.table_name
    ),
    'timestamp', pdts.timestamp,
    'profileData', pdts.json,
    'profileType', 'column'
)
WHERE pdts.extension = 'table.columnProfile';

-- Step 4: Clean up
DROP TEMPORARY TABLE IF EXISTS column_to_table_mapping;

-- Drop temporary indexes after migration
DROP INDEX idx_pdts_entityFQNHash ON profiler_data_time_series;
DROP INDEX idx_pdts_entityFQNHash_prefix ON profiler_data_time_series;
DROP INDEX idx_pdts_extension ON profiler_data_time_series;
DROP INDEX idx_te_fqnHash ON table_entity;
DROP INDEX idx_pdts_composite ON profiler_data_time_series;

-- Analyze tables after migration for updated statistics
ANALYZE TABLE profiler_data_time_series;
ANALYZE TABLE table_entity;

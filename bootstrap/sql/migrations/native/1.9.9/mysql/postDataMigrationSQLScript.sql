-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdts_entityFQNHash ON profiler_data_time_series(entityFQNHash);
CREATE INDEX IF NOT EXISTS idx_pdts_extension ON profiler_data_time_series(extension);
CREATE INDEX IF NOT EXISTS idx_te_fqnHash ON table_entity(fqnHash);

-- Add prefix index for LIKE queries (service.database.schema.table = 4 MD5 hashes + 3 dots = 131 chars)
CREATE INDEX IF NOT EXISTS idx_pdts_entityFQNHash_prefix ON profiler_data_time_series(entityFQNHash(131));

-- Add composite index for better join performance
CREATE INDEX IF NOT EXISTS idx_pdts_composite ON profiler_data_time_series(extension, entityFQNHash);

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

-- Migrate column profiles using temporary mapping table for better performance
-- Create temporary mapping table to extract table hash from column hash
CREATE TEMPORARY TABLE IF NOT EXISTS column_to_table_mapping (
    column_hash VARCHAR(768) PRIMARY KEY,
    table_hash VARCHAR(768),
    INDEX idx_table_hash (table_hash)
) ENGINE=MEMORY;

-- Populate mapping by extracting table hash (everything before the last dot)
INSERT INTO column_to_table_mapping (column_hash, table_hash)
SELECT DISTINCT
    pdts.entityFQNHash as column_hash,
    SUBSTRING_INDEX(pdts.entityFQNHash, '.', 4) as table_hash
FROM profiler_data_time_series pdts
WHERE pdts.extension = 'table.columnProfile'
  AND CHAR_LENGTH(pdts.entityFQNHash) - CHAR_LENGTH(REPLACE(pdts.entityFQNHash, '.', '')) >= 4;

-- Update column profiles using the mapping (much faster than LIKE)
UPDATE profiler_data_time_series pdts
INNER JOIN column_to_table_mapping ctm ON pdts.entityFQNHash = ctm.column_hash
INNER JOIN table_entity te ON ctm.table_hash = te.fqnHash
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

-- Clean up temporary table
DROP TEMPORARY TABLE IF EXISTS column_to_table_mapping;

-- Drop temporary indexes after migration
DROP INDEX IF EXISTS idx_pdts_entityFQNHash ON profiler_data_time_series;
DROP INDEX IF EXISTS idx_pdts_entityFQNHash_prefix ON profiler_data_time_series;
DROP INDEX IF EXISTS idx_pdts_extension ON profiler_data_time_series;
DROP INDEX IF EXISTS idx_te_fqnHash ON table_entity;
DROP INDEX IF EXISTS idx_pdts_composite ON profiler_data_time_series;

-- Analyze tables after migration for updated statistics
ANALYZE TABLE profiler_data_time_series;
ANALYZE TABLE table_entity;

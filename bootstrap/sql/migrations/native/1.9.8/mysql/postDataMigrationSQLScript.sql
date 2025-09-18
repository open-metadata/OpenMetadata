-- Create indexes for better performance
CREATE INDEX idx_pdts_entityFQNHash ON profiler_data_time_series(entityFQNHash);
CREATE INDEX idx_pdts_extension ON profiler_data_time_series(extension);
CREATE INDEX idx_te_fqnHash ON table_entity(fqnHash);

-- Add prefix index for LIKE queries (service.database.schema.table = 4 MD5 hashes + 3 dots = 131 chars)
CREATE INDEX idx_pdts_entityFQNHash_prefix ON profiler_data_time_series(entityFQNHash(131));

-- Add composite index for better join performance
CREATE INDEX idx_pdts_composite ON profiler_data_time_series(extension, entityFQNHash);

-- Analyze tables for query optimizer (MySQL 8.0+)
ANALYZE TABLE profiler_data_time_series;
ANALYZE TABLE table_entity;

-- Migrate table profiles (direct match) - FAST
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

-- Migrate system profiles (direct match) - FAST
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

-- Migrate column profiles - optimized approach
-- First, let's update column profiles for tables that exist
UPDATE profiler_data_time_series pdts
SET pdts.json = (
    SELECT JSON_OBJECT(
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
    FROM table_entity te
    WHERE te.fqnHash = SUBSTRING_INDEX(pdts.entityFQNHash, '.', 4)
    LIMIT 1
)
WHERE pdts.extension = 'table.columnProfile'
  AND EXISTS (
    SELECT 1 FROM table_entity te2
    WHERE te2.fqnHash = SUBSTRING_INDEX(pdts.entityFQNHash, '.', 4)
  );

-- Drop temporary indexes after migration
DROP INDEX idx_pdts_entityFQNHash ON profiler_data_time_series;
DROP INDEX idx_pdts_entityFQNHash_prefix ON profiler_data_time_series;
DROP INDEX idx_pdts_extension ON profiler_data_time_series;
DROP INDEX idx_te_fqnHash ON table_entity;
DROP INDEX idx_pdts_composite ON profiler_data_time_series;

-- Analyze tables after migration for updated statistics
ANALYZE TABLE profiler_data_time_series;
ANALYZE TABLE table_entity;

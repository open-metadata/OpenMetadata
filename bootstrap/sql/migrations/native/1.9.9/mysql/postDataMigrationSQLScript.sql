-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdts_entityFQNHash ON profiler_data_time_series(entityFQNHash);
CREATE INDEX IF NOT EXISTS idx_pdts_extension ON profiler_data_time_series(extension);
CREATE INDEX IF NOT EXISTS idx_te_fqnHash ON table_entity(fqnHash);

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

-- Migrate column profiles (uses LIKE for nested columns)
UPDATE profiler_data_time_series pdts
INNER JOIN table_entity te ON pdts.entityFQNHash LIKE CONCAT(te.fqnHash, '.%')
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

-- Drop temporary indexes after migration
DROP INDEX IF EXISTS idx_pdts_entityFQNHash ON profiler_data_time_series;
DROP INDEX IF EXISTS idx_pdts_extension ON profiler_data_time_series;
DROP INDEX IF EXISTS idx_te_fqnHash ON table_entity;
DROP INDEX IF EXISTS idx_pdts_composite ON profiler_data_time_series;

-- Analyze tables after migration for updated statistics
ANALYZE TABLE profiler_data_time_series;
ANALYZE TABLE table_entity;

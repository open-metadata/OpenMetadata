-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdts_entityFQNHash ON profiler_data_time_series(entityFQNHash);
CREATE INDEX IF NOT EXISTS idx_pdts_extension ON profiler_data_time_series(extension);
CREATE INDEX IF NOT EXISTS idx_te_fqnHash ON table_entity(fqnHash);

-- Add composite index for better join performance
CREATE INDEX IF NOT EXISTS idx_pdts_composite ON profiler_data_time_series(extension, entityFQNHash);

-- Analyze tables for query planner optimization
ANALYZE profiler_data_time_series;
ANALYZE table_entity;

-- Set work_mem higher temporarily for better sort performance (session level)
SET LOCAL work_mem = '256MB';
SET LOCAL maintenance_work_mem = '512MB';

-- Migrate table profiles (direct match)
UPDATE profiler_data_time_series pdts
SET json = jsonb_build_object(
    'id', gen_random_uuid(),
    'entityReference', jsonb_build_object(
        'id', te.json ->> 'id',
        'type', 'table',
        'fullyQualifiedName', te.json ->> 'fullyQualifiedName',
        'name', te.name
    ),
    'timestamp', pdts.timestamp,
    'profileData', pdts.json,
    'profileType', 'table'
)
FROM table_entity te
WHERE pdts.entityFQNHash = te.fqnHash
  AND pdts.extension = 'table.tableProfile';

-- Migrate system profiles (direct match)
UPDATE profiler_data_time_series pdts
SET json = jsonb_build_object(
    'id', gen_random_uuid(),
    'entityReference', jsonb_build_object(
        'id', te.json ->> 'id',
        'type', 'table',
        'fullyQualifiedName', te.json ->> 'fullyQualifiedName',
        'name', te.name
    ),
    'timestamp', pdts.timestamp,
    'profileData', pdts.json,
    'profileType', 'system'
)
FROM table_entity te
WHERE pdts.entityFQNHash = te.fqnHash
  AND pdts.extension = 'table.systemProfile';

-- Migrate column profiles (uses LIKE for nested columns)
UPDATE profiler_data_time_series pdts
SET json = jsonb_build_object(
    'id', gen_random_uuid(),
    'entityReference', jsonb_build_object(
        'id', te.json ->> 'id',
        'type', 'table',
        'fullyQualifiedName', te.json ->> 'fullyQualifiedName',
        'name', te.name
    ),
    'timestamp', pdts.timestamp,
    'profileData', pdts.json,
    'profileType', 'column'
)
FROM table_entity te
WHERE pdts.entityFQNHash LIKE CONCAT(te.fqnHash, '.%')
  AND pdts.extension = 'table.columnProfile';

-- Drop temporary indexes after migration
DROP INDEX IF EXISTS idx_pdts_entityFQNHash;
DROP INDEX IF EXISTS idx_pdts_extension;
DROP INDEX IF EXISTS idx_te_fqnHash;
DROP INDEX IF EXISTS idx_pdts_composite;

-- Reset work_mem to default
RESET work_mem;
RESET maintenance_work_mem;

-- Analyze tables after migration for updated statistics
ANALYZE profiler_data_time_series;
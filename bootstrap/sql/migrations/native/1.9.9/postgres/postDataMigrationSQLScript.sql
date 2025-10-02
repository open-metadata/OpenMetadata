-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdts_entityFQNHash ON profiler_data_time_series(entityFQNHash);
CREATE INDEX IF NOT EXISTS idx_pdts_extension ON profiler_data_time_series(extension);
CREATE INDEX IF NOT EXISTS idx_te_fqnHash ON table_entity(fqnHash);

-- Add prefix index for LIKE queries (service.database.schema.table = 4 MD5 hashes + 3 dots = 132 chars)
CREATE INDEX IF NOT EXISTS idx_pdts_entityFQNHash_prefix ON profiler_data_time_series(substring(entityFQNHash, 1, 132));

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
  AND pdts.extension = 'table.tableProfile'
  AND pdts.json->>'profileData' IS NULL;

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
  AND pdts.extension = 'table.systemProfile'
  AND pdts.json->>'profileData' IS NULL;

-- Migrate column profiles using temporary mapping table for better performance
-- Use UNLOGGED table for memory-like performance (no WAL writes)
CREATE UNLOGGED TABLE IF NOT EXISTS column_to_table_mapping (
    column_hash VARCHAR(768) PRIMARY KEY,
    table_hash VARCHAR(768)
);
CREATE INDEX idx_ctm_table_hash ON column_to_table_mapping(table_hash);

-- Optimize for in-memory operations
ALTER TABLE column_to_table_mapping SET (autovacuum_enabled = false);
SET LOCAL temp_buffers = '256MB';  -- Increase temp buffer size
SET LOCAL work_mem = '256MB';      -- Already set above but ensuring it's set

-- Populate mapping by extracting table hash (first 4 dot-separated parts)
INSERT INTO column_to_table_mapping (column_hash, table_hash)
SELECT DISTINCT
    pdts.entityFQNHash as column_hash,
    SPLIT_PART(pdts.entityFQNHash, '.', 1) || '.' ||
    SPLIT_PART(pdts.entityFQNHash, '.', 2) || '.' ||
    SPLIT_PART(pdts.entityFQNHash, '.', 3) || '.' ||
    SPLIT_PART(pdts.entityFQNHash, '.', 4) as table_hash
FROM profiler_data_time_series pdts
WHERE pdts.extension = 'table.columnProfile'
  AND ARRAY_LENGTH(STRING_TO_ARRAY(pdts.entityFQNHash, '.'), 1) >= 5;

-- Update column profiles using the mapping (much faster than LIKE)
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
FROM column_to_table_mapping ctm
INNER JOIN table_entity te ON ctm.table_hash = te.fqnHash
WHERE pdts.entityFQNHash = ctm.column_hash
  AND pdts.extension = 'table.columnProfile'
  AND pdts.json->>'profileData' IS NULL;

-- Clean up temporary table
DROP TABLE IF EXISTS column_to_table_mapping;

-- Reset temp buffers
RESET temp_buffers;

-- Drop temporary indexes after migration
DROP INDEX IF EXISTS idx_pdts_entityFQNHash;
DROP INDEX IF EXISTS idx_pdts_entityFQNHash_prefix;
DROP INDEX IF EXISTS idx_pdts_extension;
DROP INDEX IF EXISTS idx_te_fqnHash;
DROP INDEX IF EXISTS idx_pdts_composite;

-- Reset work_mem to default
RESET work_mem;
RESET maintenance_work_mem;

-- Analyze tables after migration for updated statistics
ANALYZE profiler_data_time_series;

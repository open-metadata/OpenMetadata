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
WHERE pdts.extension = 'table.tableProfile'
AND pdts.json->>'$.profileData' IS NULL;

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
WHERE pdts.extension = 'table.systemProfile'
AND pdts.json->>'$.profileData' IS NULL;

-- Migrate column profiles using temporary mapping table for better performance
-- Create temporary mapping table to extract table hash from column hash
CREATE TEMPORARY TABLE IF NOT EXISTS column_to_table_mapping (
    column_hash VARCHAR(768) PRIMARY KEY,
    table_hash VARCHAR(768),
    INDEX idx_table_hash (table_hash)
) ENGINE=InnoDB;

-- Populate mapping by extracting table hash (everything before the last dot)
INSERT INTO column_to_table_mapping (column_hash, table_hash)
SELECT DISTINCT
    pdts.entityFQNHash as column_hash,
    SUBSTRING_INDEX(pdts.entityFQNHash, '.', 4) as table_hash
FROM profiler_data_time_series pdts
WHERE pdts.extension = 'table.columnProfile'
  AND CHAR_LENGTH(pdts.entityFQNHash) - CHAR_LENGTH(REPLACE(pdts.entityFQNHash, '.', '')) >= 4;

-- Create temporary table with pre-computed entityReference data
CREATE TEMPORARY TABLE IF NOT EXISTS table_entity_references (
    table_hash VARCHAR(768) PRIMARY KEY,
    entity_reference JSON,
    INDEX idx_hash (table_hash)
) ENGINE=InnoDB;

-- Pre-compute all entityReference data for tables involved in column profiles
INSERT INTO table_entity_references (table_hash, entity_reference)
SELECT DISTINCT
    ctm.table_hash,
    JSON_OBJECT(
        'id', te.json -> '$.id',
        'type', 'table',
        'fullyQualifiedName', te.json -> '$.fullyQualifiedName',
        'name', te.name
    ) as entity_reference
FROM column_to_table_mapping ctm
INNER JOIN table_entity te ON ctm.table_hash = te.fqnHash;

DELIMITER $$
CREATE PROCEDURE MigrateColumnProfiles()
BEGIN
	
    DECLARE current_start_timestamp BIGINT;
    DECLARE current_end_timestamp BIGINT;
    DECLARE max_timestamp BIGINT;
    DECLARE batch_interval_ms BIGINT DEFAULT 1296000000; -- 15 days in milliseconds (15 * 24 * 60 * 60 * 1000)
    DECLARE rows_updated INT DEFAULT 1;
    DECLARE total_processed INT DEFAULT 0;
    DECLARE batch_count INT DEFAULT 0;

    -- Optimize session settings
    SET SESSION tmp_table_size = 4294967296;
    SET SESSION max_heap_table_size = 4294967296;
    SET SESSION sort_buffer_size = 536870912;

    -- Get the timestamp range for column profiles
    SELECT 
        MIN(timestamp),
        MAX(timestamp)
    INTO current_start_timestamp, max_timestamp
    FROM profiler_data_time_series 
    WHERE extension = 'table.columnProfile';
    
    CREATE INDEX idx_pdts_timestamp_ext ON profiler_data_time_series(extension, timestamp);
    
    -- Process in timestamp batches
    migration_loop: WHILE current_start_timestamp <= max_timestamp AND rows_updated > 0 DO
        SET current_end_timestamp = current_start_timestamp + batch_interval_ms;
        SET batch_count = batch_count + 1;
        
        -- Update records in current timestamp range using pre-computed entity references
        UPDATE profiler_data_time_series pdts
        INNER JOIN column_to_table_mapping ctm ON pdts.entityFQNHash = ctm.column_hash
        INNER JOIN table_entity_references ter ON ctm.table_hash = ter.table_hash
        SET pdts.json = JSON_OBJECT(
            'id', UUID(),
            'entityReference', ter.entity_reference,
            'timestamp', pdts.timestamp,
            'profileData', pdts.json,
            'profileType', 'column'
        )
        WHERE pdts.extension = 'table.columnProfile'
          AND pdts.timestamp >= current_start_timestamp
          AND pdts.timestamp < current_end_timestamp
          AND pdts.json->>'$.profileData' IS NULL;
        
        
        -- Move to next timestamp batch
        SET current_start_timestamp = current_end_timestamp;
        
        -- Safety check - avoid runaway processes
        IF total_processed > 50000000 OR batch_count > 1000 THEN
            SELECT CONCAT('Safety limit reached. Total processed: ', total_processed, 
                         ', Batches: ', batch_count) as safety_stop;
            LEAVE migration_loop;
        END IF;   
        
    END WHILE;
    DROP INDEX idx_pdts_timestamp_ext ON profiler_data_time_series;
    
END$$
DELIMITER ;

-- Execute the migration
CALL MigrateColumnProfiles();

-- Clean up the procedure
DROP PROCEDURE MigrateColumnProfiles;


-- Clean up temporary table
DROP TEMPORARY TABLE IF EXISTS column_to_table_mapping;
DROP TEMPORARY TABLE IF EXISTS table_entity_references;


-- Drop temporary indexes after migration
DROP INDEX idx_pdts_entityFQNHash ON profiler_data_time_series;
DROP INDEX idx_pdts_entityFQNHash_prefix ON profiler_data_time_series;
DROP INDEX idx_pdts_extension ON profiler_data_time_series;
DROP INDEX idx_te_fqnHash ON table_entity;
DROP INDEX idx_pdts_composite ON profiler_data_time_series;

-- Analyze tables after migration for updated statistics
ANALYZE TABLE profiler_data_time_series;
ANALYZE TABLE table_entity;

-- Migrate Salesforce connection from sobjectName (string) to sobjectNames (array)
-- Converts sobjectName to sobjectNames array and removes the old field

UPDATE dbservice_entity
SET json = jsonb_set(
    json::jsonb #- '{connection,config,sobjectName}',
    '{connection,config,sobjectNames}',
    jsonb_build_array(json->'connection'->'config'->>'sobjectName')
)::json
WHERE serviceType = 'Salesforce'
  AND json->'connection'->'config'->>'sobjectName' IS NOT NULL;

-- No changes needed for PostgreSQL - TIMESTAMP already has microsecond precision.

-- No changes needed for entity_extension_time_series.timestamp on PostgreSQL.
-- PostgreSQL already uses STORED for the generated timestamp column (since table creation).
-- MySQL migration changes it from VIRTUAL to STORED for consistency and performance.

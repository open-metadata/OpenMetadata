-- Fix hanging partition migration
-- in 1.4.x `tablePartition.intervalType` should not exists
UPDATE table_entity
SET json = JSON_REMOVE(json, '$.tablePartition')
WHERE JSON_EXTRACT(json, '$.tablePartition.intervalType') IS NOT NULL;
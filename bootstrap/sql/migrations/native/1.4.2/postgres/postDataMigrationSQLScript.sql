-- Fix hanging partition migration
-- in 1.4.x `tablePartition.intervalType` should not exists
UPDATE table_entity
SET json = json - 'tablePartition'
WHERE json->'tablePartition'->'intervalType' is not null;
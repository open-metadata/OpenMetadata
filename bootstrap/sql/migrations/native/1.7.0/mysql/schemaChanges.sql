UPDATE workflow_definition_entity
SET json = JSON_REMOVE(json, '$.type')
WHERE JSON_EXTRACT(json, '$.type') IS NOT NULL;

UPDATE table_entity
SET json = JSON_SET(json, '$.changeSummary', JSON_OBJECT())
WHERE JSON_EXTRACT(json, '$.changeSummary') IS NULL;
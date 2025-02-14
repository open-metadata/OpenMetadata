UPDATE workflow_definition_entity
SET json = JSON_REMOVE(json, '$.type')
WHERE JSON_EXTRACT(json, '$.type') IS NOT NULL;

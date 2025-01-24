UPDATE workflow_definition_entity
SET json = json - 'type'
WHERE json->>'type' IS NOT NULL;
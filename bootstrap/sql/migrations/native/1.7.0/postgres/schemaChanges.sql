UPDATE workflow_definition_entity
SET json = jsonb - 'type'
WHERE json->>'type' IS NOT NULL;
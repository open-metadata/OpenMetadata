UPDATE workflow_definition_entity
SET json = json - 'type'
WHERE json->>'type' IS NOT NULL;

UPDATE table_entity
SET json = jsonb_set(json, '{changeSummary}', '{}'::jsonb)
WHERE jsonb_extract_path(json, 'changeSummary') IS NULL;

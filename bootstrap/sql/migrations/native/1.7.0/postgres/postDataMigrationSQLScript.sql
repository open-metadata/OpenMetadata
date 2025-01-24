UPDATE workflow_definition_entity
SET json = jsonb_set(json, '{trigger,type}', '"eventBasedEntity"')
WHERE json->'trigger'->>'type' = 'eventBasedEntityWorkflow';

UPDATE workflow_definition_entity
SET json = jsonb_set(json, '{trigger,type}', '"periodicBatchEntity"')
WHERE json->'trigger'->>'type' = 'periodicBatchEntityWorkflow';
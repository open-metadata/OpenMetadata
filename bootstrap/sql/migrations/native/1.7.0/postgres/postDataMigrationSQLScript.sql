UPDATE workflow_definition_entity
SET json = jsonb_set(json, '{trigger,type}', '"eventBasedEntity"')
fixWHERE json->'trigger'->>'type' = 'eventBasedEntityTrigger';

UPDATE workflow_definition_entity
SET json = jsonb_set(json, '{trigger,type}', '"periodicBatchEntity"')
WHERE json->'trigger'->>'type' = 'periodicBatchEntityTrigger';
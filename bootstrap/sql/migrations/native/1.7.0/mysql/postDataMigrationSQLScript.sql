UPDATE workflow_definition_entity
SET json = JSON_SET(json, '$.trigger.type', 'eventBasedEntity')
WHERE JSON_EXTRACT(json, '$.trigger.type') in ('eventBasedEntityTrigger', 'eventBasedEntityWorkflow');

UPDATE workflow_definition_entity
SET json = JSON_SET(json, '$.trigger.type', 'periodicBatchEntity')
WHERE JSON_EXTRACT(json, '$.trigger.type') in ('periodicBatchEntityTrigger', 'periodicBatchEntityWorkflow');

UPDATE test_case
SET json = json_set(json, '$.createdBy', json->>'$.updatedBy')
WHERE json->>'$.createdBy' IS NULL;
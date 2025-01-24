UPDATE workflow_definition_entity
SET json = JSON_SET(json, '$.trigger.type', 'eventBasedEntity')
WHERE JSON_EXTRACT(json, '$.trigger.type') = 'eventBasedEntityWorkflow';

UPDATE workflow_definition_entity
SET json = JSON_SET(json, '$.trigger.type', 'periodicBatchEntity')
WHERE JSON_EXTRACT(json, '$.trigger.type') = 'periodicBatchEntityWorkflow';
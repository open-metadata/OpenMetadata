DELETE from ingestion_pipeline_entity where 1=1;
DELETE from entity_relationship where toEntity = 'ingestionPipeline';

-- 0.10 had empty FQNs for services, users and teams
UPDATE dbservice_entity
SET json = jsonb_set(json, '{fullyQualifiedName}', json#>'{name}')
WHERE json#>'{fullyQualifiedName}' is NULL;

UPDATE dashboard_service_entity
SET json = jsonb_set(json, '{fullyQualifiedName}', json#>'{name}')
WHERE json#>'{fullyQualifiedName}' is NULL;

UPDATE messaging_service_entity
SET json = jsonb_set(json, '{fullyQualifiedName}', json#>'{name}')
WHERE json#>'{fullyQualifiedName}' is NULL;

UPDATE pipeline_service_entity
SET json = jsonb_set(json, '{fullyQualifiedName}', json#>'{name}')
WHERE json#>'{fullyQualifiedName}' is NULL;

UPDATE storage_service_entity
SET json = jsonb_set(json, '{fullyQualifiedName}', json#>'{name}')
WHERE json#>'{fullyQualifiedName}' is NULL;

UPDATE team_entity
SET json = jsonb_set(json, '{fullyQualifiedName}', json#>'{name}')
WHERE json#>'{fullyQualifiedName}' is NULL;

UPDATE user_entity
SET json = jsonb_set(json, '{fullyQualifiedName}', json#>'{name}')
WHERE json#>'{fullyQualifiedName}' is NULL;

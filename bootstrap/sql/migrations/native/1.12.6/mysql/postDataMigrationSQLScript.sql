-- Remove pipeline annotation from service-level, domain-level, and dataProduct-level lineage edges.
-- These edges incorrectly inherited the pipeline annotation from entity-level lineage, causing service
-- nodes to appear in entity-level lineage views and the "By Service" view to be empty for pipeline
-- entities. After this migration, run an Elasticsearch/OpenSearch reindex to update search documents.
UPDATE entity_relationship
SET json = JSON_REMOVE(json, '$.pipeline')
WHERE fromEntity IN ('databaseService', 'messagingService', 'pipelineService', 'dashboardService',
                     'mlmodelService', 'metadataService', 'storageService', 'searchService', 'apiService',
                     'driveService')
  AND toEntity IN ('databaseService', 'messagingService', 'pipelineService', 'dashboardService',
                   'mlmodelService', 'metadataService', 'storageService', 'searchService', 'apiService',
                   'driveService')
  AND relation = 13
  AND JSON_CONTAINS_PATH(json, 'one', '$.pipeline');

UPDATE entity_relationship
SET json = JSON_REMOVE(json, '$.pipeline')
WHERE fromEntity = 'domain' AND toEntity = 'domain'
  AND relation = 13
  AND JSON_EXTRACT(json, '$.pipeline') IS NOT NULL;

UPDATE entity_relationship
SET json = JSON_REMOVE(json, '$.pipeline')
WHERE fromEntity = 'dataProduct' AND toEntity = 'dataProduct'
  AND relation = 13
  AND JSON_EXTRACT(json, '$.pipeline') IS NOT NULL;
  

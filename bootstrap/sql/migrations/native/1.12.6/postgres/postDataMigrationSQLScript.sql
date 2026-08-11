-- Remove pipeline annotation from service-level, domain-level, and dataProduct-level lineage edges.
-- These edges incorrectly inherited the pipeline annotation from entity-level lineage, causing service
-- nodes to appear in entity-level lineage views and the "By Service" view to be empty for pipeline
-- entities. After this migration, run an Elasticsearch/OpenSearch reindex to update search documents.
UPDATE entity_relationship
SET json = json - 'pipeline'
WHERE fromentity IN ('databaseService', 'messagingService', 'pipelineService', 'dashboardService',
                     'mlmodelService', 'metadataService', 'storageService', 'searchService', 'apiService',
                     'driveService')
  AND toentity IN ('databaseService', 'messagingService', 'pipelineService', 'dashboardService',
                   'mlmodelService', 'metadataService', 'storageService', 'searchService', 'apiService',
                   'driveService')
  AND relation = 13
  AND json ?? 'pipeline';

UPDATE entity_relationship
SET json = json - 'pipeline'
WHERE fromentity = 'domain' AND toentity = 'domain'
  AND relation = 13
  AND json ?? 'pipeline';

UPDATE entity_relationship
SET json = json - 'pipeline'
WHERE fromentity = 'dataProduct' AND toentity = 'dataProduct'
  AND relation = 13
  AND json ?? 'pipeline';


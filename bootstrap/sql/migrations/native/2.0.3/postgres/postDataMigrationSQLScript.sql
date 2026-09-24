-- Post data migration script for OpenMetadata 2.0.3
-- Backfill for glossaryTermRelationSettings cardinality runs in the Java migration step.

-- RDF reindexing runs on one server now, so its consumer, queue, distributed and partition
-- settings are gone. The app configuration is additionalProperties:false, so strip them from
-- every persisted RdfIndexApp config or the settings form rejects it on save.
UPDATE installed_apps
SET json = jsonb_set(
    json::jsonb,
    '{appConfiguration}',
    (json::jsonb -> 'appConfiguration')
      - ARRAY['consumerThreads', 'queueSize', 'useDistributedIndexing', 'partitionSize'])
WHERE name = 'RdfIndexApp'
  AND jsonb_exists(json::jsonb, 'appConfiguration');

UPDATE apps_marketplace
SET json = jsonb_set(
    json::jsonb,
    '{appConfiguration}',
    (json::jsonb -> 'appConfiguration')
      - ARRAY['consumerThreads', 'queueSize', 'useDistributedIndexing', 'partitionSize'])
WHERE name = 'RdfIndexApp'
  AND jsonb_exists(json::jsonb, 'appConfiguration');

UPDATE entity_extension
SET json = jsonb_set(
    json::jsonb,
    '{appConfiguration}',
    (json::jsonb -> 'appConfiguration')
      - ARRAY['consumerThreads', 'queueSize', 'useDistributedIndexing', 'partitionSize'])
WHERE extension LIKE 'app.version.%'
  AND json::jsonb ->> 'name' = 'RdfIndexApp'
  AND jsonb_exists(json::jsonb, 'appConfiguration');

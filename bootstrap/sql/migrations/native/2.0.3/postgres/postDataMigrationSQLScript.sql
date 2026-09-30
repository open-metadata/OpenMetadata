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

-- Joined through installed_apps so only the app's own version rows are read, by primary key.
UPDATE entity_extension ee
SET json = jsonb_set(
    ee.json::jsonb,
    '{appConfiguration}',
    (ee.json::jsonb -> 'appConfiguration')
      - ARRAY['consumerThreads', 'queueSize', 'useDistributedIndexing', 'partitionSize'])
FROM installed_apps ia
WHERE ee.id = ia.id
  AND ia.name = 'RdfIndexApp'
  AND ee.extension LIKE 'app.version.%'
  AND jsonb_exists(ee.json::jsonb, 'appConfiguration');

-- producerThreads now has a maximum of 10, so a larger stored value would also be rejected.
-- Compared as jsonb rather than cast, so a missing or non-numeric value cannot fail the migration.
UPDATE installed_apps
SET json = jsonb_set(json::jsonb, '{appConfiguration,producerThreads}', '10'::jsonb)
WHERE name = 'RdfIndexApp'
  AND (json::jsonb #> '{appConfiguration,producerThreads}') > '10'::jsonb
  AND jsonb_typeof(json::jsonb #> '{appConfiguration,producerThreads}') = 'number';

UPDATE apps_marketplace
SET json = jsonb_set(json::jsonb, '{appConfiguration,producerThreads}', '10'::jsonb)
WHERE name = 'RdfIndexApp'
  AND (json::jsonb #> '{appConfiguration,producerThreads}') > '10'::jsonb
  AND jsonb_typeof(json::jsonb #> '{appConfiguration,producerThreads}') = 'number';

UPDATE entity_extension ee
SET json = jsonb_set(ee.json::jsonb, '{appConfiguration,producerThreads}', '10'::jsonb)
FROM installed_apps ia
WHERE ee.id = ia.id
  AND ia.name = 'RdfIndexApp'
  AND ee.extension LIKE 'app.version.%'
  AND (ee.json::jsonb #> '{appConfiguration,producerThreads}') > '10'::jsonb
  AND jsonb_typeof(ee.json::jsonb #> '{appConfiguration,producerThreads}') = 'number';

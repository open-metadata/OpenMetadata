-- Post data migration script for OpenMetadata 2.0.3
-- Backfill for glossaryTermRelationSettings cardinality runs in the Java migration step.

-- RDF reindexing runs on one server now, so its consumer, queue, distributed and partition
-- settings are gone. The app configuration is additionalProperties:false, so strip them from
-- every persisted RdfIndexApp config or the settings form rejects it on save.
UPDATE installed_apps
SET json = JSON_REMOVE(json,
    '$.appConfiguration.consumerThreads',
    '$.appConfiguration.queueSize',
    '$.appConfiguration.useDistributedIndexing',
    '$.appConfiguration.partitionSize')
WHERE name = 'RdfIndexApp';

UPDATE apps_marketplace
SET json = JSON_REMOVE(json,
    '$.appConfiguration.consumerThreads',
    '$.appConfiguration.queueSize',
    '$.appConfiguration.useDistributedIndexing',
    '$.appConfiguration.partitionSize')
WHERE name = 'RdfIndexApp';

UPDATE entity_extension
SET json = JSON_REMOVE(json,
    '$.appConfiguration.consumerThreads',
    '$.appConfiguration.queueSize',
    '$.appConfiguration.useDistributedIndexing',
    '$.appConfiguration.partitionSize')
WHERE extension LIKE 'app.version.%'
  AND json->>'$.name' = 'RdfIndexApp';

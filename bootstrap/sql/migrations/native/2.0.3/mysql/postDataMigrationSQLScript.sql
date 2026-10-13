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

-- Joined through installed_apps so only the app's own version rows are read, by primary key.
UPDATE entity_extension ee
JOIN installed_apps ia ON ee.id = ia.id
SET ee.json = JSON_REMOVE(ee.json,
    '$.appConfiguration.consumerThreads',
    '$.appConfiguration.queueSize',
    '$.appConfiguration.useDistributedIndexing',
    '$.appConfiguration.partitionSize')
WHERE ia.name = 'RdfIndexApp'
  AND ee.extension LIKE 'app.version.%';

-- producerThreads now has a maximum of 10, so a larger stored value would also be rejected.
UPDATE installed_apps
SET json = JSON_SET(json, '$.appConfiguration.producerThreads', 10)
WHERE name = 'RdfIndexApp'
  AND JSON_EXTRACT(json, '$.appConfiguration.producerThreads') > 10;

UPDATE apps_marketplace
SET json = JSON_SET(json, '$.appConfiguration.producerThreads', 10)
WHERE name = 'RdfIndexApp'
  AND JSON_EXTRACT(json, '$.appConfiguration.producerThreads') > 10;

UPDATE entity_extension ee
JOIN installed_apps ia ON ee.id = ia.id
SET ee.json = JSON_SET(ee.json, '$.appConfiguration.producerThreads', 10)
WHERE ia.name = 'RdfIndexApp'
  AND ee.extension LIKE 'app.version.%'
  AND JSON_EXTRACT(ee.json, '$.appConfiguration.producerThreads') > 10;

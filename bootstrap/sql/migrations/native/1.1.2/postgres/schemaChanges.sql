ALTER TABLE entity_extension_time_series ALTER COLUMN entityFQNHash TYPE VARCHAR(768), ALTER COLUMN jsonSchema TYPE VARCHAR(50) , ALTER COLUMN extension TYPE VARCHAR(100) ,
    ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityFQNHash, extension, timestamp);
ALTER TABLE field_relationship ALTER COLUMN fromFQNHash TYPE VARCHAR(768), ALTER COLUMN toFQNHash TYPE VARCHAR(768);
ALTER TABLE thread_entity ALTER COLUMN entityLink TYPE VARCHAR(3072);
ALTER TABLE tag_usage ALTER COLUMN tagFQNHash TYPE VARCHAR(768), ALTER COLUMN targetFQNHash TYPE VARCHAR(768);
ALTER TABLE test_suite ALTER COLUMN fqnHash TYPE VARCHAR(768);

UPDATE dbservice_entity
SET json = JSON_SET(
        JSON_REMOVE(json, '$.connection.config.connectionOptions'),
        '$.connection.config.connectionOptions',
        JSON_EXTRACT(json, '$.connection.config.params')
    )
WHERE serviceType = 'Trino';

UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.params')
WHERE serviceType = 'Trino';

-- Modify migrations for service connection of trino to move password under authType
UPDATE dbservice_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.password'),
        '$.connection.config.authType',
        JSON_OBJECT(),
        '$.connection.config.authType.password',
        JSON_EXTRACT(json, '$.connection.config.password'))
where serviceType = 'Trino'
  AND JSON_EXTRACT(json, '$.connection.config.password') IS NOT NULL;

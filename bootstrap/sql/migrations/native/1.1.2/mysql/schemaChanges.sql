-- queries to rename params to connectionOptions for trino
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

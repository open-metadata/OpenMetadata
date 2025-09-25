-- Migration script to restructure Databricks connection configuration
-- Move 'token' field from connection.config.token to connection.config.authType.token
UPDATE dbservice_entity
SET
    json = JSON_SET (
        JSON_REMOVE (json, '$.connection.config.token'),
        '$.connection.config.authType',
        JSON_OBJECT (
            'token',
            JSON_EXTRACT (json, '$.connection.config.token')
        )
    )
WHERE
    serviceType in ('Databricks', 'UnityCatalog');
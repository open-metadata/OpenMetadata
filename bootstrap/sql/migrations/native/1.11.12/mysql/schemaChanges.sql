-- Migrate Redshift connection: move password into authType.password (basicAuth)
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.password'),
    '$.connection.config.authType',
    JSON_OBJECT(
        'password',
        JSON_EXTRACT(json, '$.connection.config.password')
    )
)
WHERE serviceType = 'Redshift'
  AND JSON_EXTRACT(json, '$.connection.config.password') IS NOT NULL
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.connection.config.authType');

-- Migrate REST API service connections: move flat openAPISchemaURL into nested openAPISchemaConnection object
UPDATE api_service_entity
SET json = JSON_SET(
    JSON_REMOVE(json, '$.connection.config.openAPISchemaURL'),
    '$.connection.config.openAPISchemaConnection',
    JSON_OBJECT(
        'openAPISchemaURL',
        JSON_UNQUOTE(JSON_EXTRACT(json, '$.connection.config.openAPISchemaURL'))
    )
)
WHERE serviceType = 'Rest'
  AND JSON_CONTAINS_PATH(json, 'one', '$.connection.config.openAPISchemaURL')
  AND NOT JSON_CONTAINS_PATH(json, 'one', '$.connection.config.openAPISchemaConnection');

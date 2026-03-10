-- Migrate REST API service connections: move flat openAPISchemaURL into nested openAPISchemaConnection object
UPDATE api_service_entity
SET json = jsonb_set(
    json #- '{connection,config,openAPISchemaURL}',
    '{connection,config,openAPISchemaConnection}',
    jsonb_build_object('openAPISchemaURL', json #> '{connection,config,openAPISchemaURL}'),
    true
)
WHERE serviceType = 'Rest'
  AND jsonb_exists(json -> 'connection' -> 'config', 'openAPISchemaURL')
  AND NOT jsonb_exists(json -> 'connection' -> 'config', 'openAPISchemaConnection');

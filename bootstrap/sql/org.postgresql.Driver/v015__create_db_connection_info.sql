-- column deleted not needed for entities that don't support soft delete
ALTER TABLE query_entity DROP COLUMN deleted;
ALTER TABLE event_subscription_entity DROP COLUMN deleted;

-- queries to rename params to connectionOptions for trino
UPDATE dbservice_entity
SET json = jsonb_set(
    json,
    '{connection,config,connectionOptions}',
    jsonb_extract_path(json, 'connection', 'config', 'params'),
    true
)
WHERE serviceType = 'Trino';

UPDATE dbservice_entity
SET json = jsonb_set(
    json,
    '{connection,config,params}',
    'null',
    false
)
WHERE serviceType = 'Trino';

-- Modify migrations for service connection of trino to move password under authType
UPDATE dbservice_entity
SET json =  jsonb_set(
json #-'{connection,config,password}',
'{connection,config,authType}',
jsonb_build_object('password',json#>'{connection,config,password}')
)
WHERE serviceType = 'Trino'
  and json#>'{connection,config,password}' is not null;

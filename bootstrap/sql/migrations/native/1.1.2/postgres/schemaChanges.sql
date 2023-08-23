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
SET json = json::jsonb #- '{connection,config,params}'
where json #> '{serviceType}' in ('"Trino"');

-- Modify migrations for service connection of trino to move password under authType
UPDATE dbservice_entity
SET json =  jsonb_set(
json #-'{connection,config,password}',
'{connection,config,authType}',
jsonb_build_object('password',json#>'{connection,config,password}')
)
WHERE serviceType = 'Trino'
  and json#>'{connection,config,password}' is not null;

-- Update table and column profile timestamps to be in milliseconds
UPDATE entity_extension_time_series
SET json = jsonb_set(
	json,
	'{timestamp}',
	to_jsonb(cast(json#>'{timestamp}' as int8) *1000)
)
WHERE
	extension  in ('table.tableProfile', 'table.columnProfile');
;
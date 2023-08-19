ALTER TABLE entity_extension_time_series ALTER COLUMN entityFQNHash TYPE VARCHAR(768), ALTER COLUMN jsonSchema TYPE VARCHAR(50) , ALTER COLUMN extension TYPE VARCHAR(100) ,
    ADD CONSTRAINT entity_extension_time_series_constraint UNIQUE (entityFQNHash, extension, timestamp);
ALTER TABLE field_relationship ALTER COLUMN fromFQNHash TYPE VARCHAR(768), ALTER COLUMN toFQNHash TYPE VARCHAR(768);
ALTER TABLE thread_entity ALTER COLUMN entityLink TYPE VARCHAR(3072);
ALTER TABLE tag_usage ALTER COLUMN tagFQNHash TYPE VARCHAR(768), ALTER COLUMN targetFQNHash TYPE VARCHAR(768);
ALTER TABLE test_suite ALTER COLUMN fqnHash TYPE VARCHAR(768);

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

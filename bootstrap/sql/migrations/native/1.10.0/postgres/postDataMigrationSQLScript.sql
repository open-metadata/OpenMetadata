-- Migration script to restructure Databricks connection configuration
-- Move 'token' field from connection.config.token to connection.config.authType.token

UPDATE dbservice_entity 
SET json = jsonb_set(
    json #- '{connection,config,token}',
    '{connection,config,authType}',
    jsonb_build_object('token', json #> '{connection,config,token}'),
    true
)
WHERE serviceType in ('Databricks', 'UnityCatalog');

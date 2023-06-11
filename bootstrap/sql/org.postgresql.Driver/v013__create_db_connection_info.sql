-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = json::jsonb #- '{openMetadataServerConnection.secretsManagerCredentials}'
where name = 'OpenMetadata';

-- Rename githubCredentials to gitCredentials
UPDATE dashboard_service_entity
SET json = jsonb_set(json, '{connection,config,gitCredentials}', json#>'{connection,config,githubCredentials}')
    where serviceType = 'Looker'
  and json#>'{connection,config,githubCredentials}' is not null;

-- Rename gcsConfig in BigQuery to gcpConfig
UPDATE dbservice_entity
SET json = jsonb_set(json, '{connection,config,credentials,gcpConfig}',
json#>'{connection,config,credentials,gcsConfig}')
where serviceType in ('BigQuery')
  and json#>'{connection,config,credentials,gcsConfig}' is not null;

-- Rename gcsConfig in Datalake to gcpConfig
UPDATE dbservice_entity
SET json = jsonb_set(json, '{connection,config,configSource,securityConfig,gcpConfig}',
json#>'{connection,config,configSource,securityConfig,gcsConfig}')
where serviceType in ('Datalake')
  and json#>'{connection,config,configSource,securityConfig,gcsConfig}' is not null;

-- Rename gcsConfig in dbt to gcpConfig
UPDATE ingestion_pipeline_entity
SET json = jsonb_set(json::jsonb #- '{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcsConfig}', '{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcpConfig}', (json#>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcsConfig}')::jsonb)
WHERE json#>>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig}' is not null and json#>>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcsConfig}' is not null;


-- Modify migrations for service connection of postgres and mysql to move password under authType
UPDATE dbservice_entity
SET json =  jsonb_set(
json #-'{connection,config,password}',
'{connection,config,authType}',
jsonb_build_object('password',json#>'{connection,config,password}')
) 
WHERE serviceType IN ('Postgres', 'Mysql')
  and json#>'{connection,config,password}' is not null;
-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = json::jsonb #- '{openMetadataServerConnection.secretsManagerCredentials}'
where name = 'OpenMetadata';


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
SET json = jsonb_set(json, '{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcpConfig}', 
json#>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcsConfig}')
WHERE json#>'{sourceConfig,config,type}' = 'DBT'
and json#>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,gcsConfig}' is not null;


ALTER TABLE test_case ADD COLUMN status VARCHAR(56) GENERATED ALWAYS AS (json -> 'testCaseResult' ->> 'testCaseStatus') STORED NULL;
ALTER TABLE test_case ADD COLUMN entityLink VARCHAR(512) GENERATED ALWAYS AS (json ->> 'entityLink') STORED NOT NULL;



-- Modify migrations for service connection of Datalake to move client secret and tenantid under azureAuthType for azure
UPDATE dbservice_entity
SET json =  jsonb_set(
json #-'{connection,config,configSource,securityConfig,clientSecret}',
'{connection,config,configSource,securityConfig,azureAuthType}',
jsonb_build_object('clientSecret',json#>'{connection,config,configSource,securityConfig,clientSecret}')
)
WHERE serviceType IN ('Datalake')
  and json#>'{connection,config,configSource,securityConfig,clientId}' is not null;

UPDATE dbservice_entity
SET json =  jsonb_set(
json #-'{connection,config,configSource,securityConfig,tenantId}',
'{connection,config,configSource,securityConfig,azureAuthType}',
jsonb_build_object('tenantId',json#>'{connection,config,configSource,securityConfig,tenantId}')
)
WHERE serviceType IN ('Datalake')
  and json#>'{connection,config,configSource,securityConfig,clientId}' is not null;


UPDATE dbservice_entity
SET json =  jsonb_set(
json #-'{connection,config,catalog,connection,fileSystem,type,clientSecret}',
'{connection,config,catalog,connection,fileSystem,type,azureAuthType}',
jsonb_build_object('clientSecret',json#>'{connection,config,catalog,connection,fileSystem,type,clientSecret}')
)
WHERE serviceType IN ('Iceberg')
  and json#>'{connection,config,catalog,connection,fileSystem,type,clientId}' is not null;

UPDATE dbservice_entity
SET json =  jsonb_set(
json #-'{connection,config,catalog,connection,fileSystem,type,tenantId}',
'{connection,config,catalog,connection,fileSystem,type,azureAuthType}',
jsonb_build_object('tenantId',json#>'{connection,config,catalog,connection,fileSystem,type,tenantId}')
)
WHERE serviceType IN ('Iceberg')
  and json#>'{connection,config,catalog,connection,fileSystem,type,clientId}' is not null;


UPDATE ingestion_pipeline_entity
SET json =  jsonb_set(
json #-'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,tenantId}',
'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,azureAuthType}',
jsonb_build_object('tenantId',json#>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,tenantId}')
) where json#>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,clientId}' is not null;

UPDATE ingestion_pipeline_entity
SET json =  jsonb_set(
json #-'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,clientSecret}',
'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,azureAuthType}',
jsonb_build_object('clientSecret',json#>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,clientSecret}')
) where json#>'{sourceConfig,config,dbtConfigSource,dbtSecurityConfig,clientId}' is not null;


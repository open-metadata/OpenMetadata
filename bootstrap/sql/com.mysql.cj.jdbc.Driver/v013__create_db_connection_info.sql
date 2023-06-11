-- we are not using the secretsManagerCredentials
UPDATE metadata_service_entity
SET json = JSON_REMOVE(json, '$.openMetadataServerConnection.secretsManagerCredentials')
where name = 'OpenMetadata';

-- Rename githubCredentials to gitCredentials
UPDATE dashboard_service_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.githubCredentials'),
        '$.connection.config.gitCredentials',
        JSON_EXTRACT(json, '$.connection.config.githubCredentials')
    )
WHERE serviceType = 'Looker'
  AND JSON_EXTRACT(json, '$.connection.config.githubCredentials') IS NOT NULL;


-- Rename gcsConfig in BigQuery to gcpConfig
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.credentials.gcsConfig'),
    '$.connection.config.credentials.gcpConfig',
    JSON_EXTRACT(json, '$.connection.config.credentials.gcsConfig')
) where serviceType in ('BigQuery');

-- Rename gcsConfig in Datalake to gcpConfig
UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.configSource.securityConfig.gcsConfig'),
    '$.connection.config.configSource.securityConfig.gcpConfig',
    JSON_EXTRACT(json, '$.connection.config.configSource.securityConfig.gcsConfig')
) where serviceType in ('Datalake');


-- Rename gcsConfig in dbt to gcpConfig
UPDATE ingestion_pipeline_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.gcsConfig'),
    '$.sourceConfig.config.dbtConfigdbtSecurityConfig.gcpConfig',
    JSON_EXTRACT(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.gcsConfig')
)
WHERE json -> '$.sourceConfig.config.type' = 'DBT';


-- Modify migrations for service connection of postgres and mysql to move password under authType

UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.password'),
    '$.connection.config.authType', 
    JSON_OBJECT(), 
    '$.connection.config.authType.password', 
    JSON_EXTRACT(json, '$.connection.config.password'))
where serviceType in ('Postgres', 'Mysql');

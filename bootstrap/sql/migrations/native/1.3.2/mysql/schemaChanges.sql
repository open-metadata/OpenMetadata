ALTER TABLE test_case ADD COLUMN status VARCHAR(56) GENERATED ALWAYS AS (json ->> '$.testCaseResult.testCaseStatus') STORED NULL;
ALTER TABLE test_case ADD COLUMN entityLink VARCHAR(512) GENERATED ALWAYS AS (json ->> '$.entityLink') STORED NOT NULL;


-- Modify migrations for service connection of Datalake to move client secret and tenantid under azureAuthType for azure

UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.configSource.securityConfig.clientSecret'),
    '$.connection.config.configSource.securityConfig.azureAuthType',
    JSON_OBJECT(),
    '$.connection.config.configSource.securityConfig.azureAuthType.clientSecret',
    JSON_EXTRACT(json, '$.connection.config.configSource.securityConfig.clientSecret'))
where serviceType in ('Datalake')
AND JSON_EXTRACT(json, '$.connection.config.configSource.securityConfig.clientId') IS NOT NULL;


UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.configSource.securityConfig.tenantId'),
    '$.connection.config.configSource.securityConfig.azureAuthType',
    JSON_OBJECT(),
    '$.connection.config.configSource.securityConfig.azureAuthType.tenantId',
    JSON_EXTRACT(json, '$.connection.config.configSource.securityConfig.tenantId'))
where serviceType in ('Datalake')
AND JSON_EXTRACT(json, '$.connection.config.configSource.securityConfig.clientId') IS NOT NULL;



UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.catalog.connection.fileSystem.type.tenantId'),
    '$.connection.config.catalog.connection.fileSystem.type.azureAuthType',
    JSON_OBJECT(),
    '$.connection.config.catalog.connection.fileSystem.type.azureAuthType.tenantId',
    JSON_EXTRACT(json, '$.connection.config.catalog.connection.fileSystem.type.tenantId'))
where serviceType in ('Iceberg')
AND JSON_EXTRACT(json, '$.connection.config.catalog.connection.fileSystem.type.clientId') IS NOT NULL;



UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.catalog.connection.fileSystem.type.clientSecret'),
    '$.connection.config.catalog.connection.fileSystem.type.azureAuthType',
    JSON_OBJECT(),
    '$.connection.config.catalog.connection.fileSystem.type.azureAuthType.clientSecret',
    JSON_EXTRACT(json, '$.connection.config.catalog.connection.fileSystem.type.clientSecret'))
where serviceType in ('Iceberg')
AND JSON_EXTRACT(json, '$.connection.config.catalog.connection.fileSystem.type.clientId') IS NOT NULL;




-- Modify migrations for ingestion pipeline entity of dbt to move client secret and tenantid under azureAuthType for azure



UPDATE ingestion_pipeline_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.clientSecret'),
    '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.azureAuthType',
    JSON_OBJECT(),
    '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.azureAuthType.clientSecret',
    JSON_EXTRACT(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.clientSecret'))
where JSON_EXTRACT(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.clientId') IS NOT NULL;


UPDATE ingestion_pipeline_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.tenantId'),
    '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.azureAuthType',
    JSON_OBJECT(),
    '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.azureAuthType.tenantId',
    JSON_EXTRACT(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.tenantId'))
where JSON_EXTRACT(json, '$.sourceConfig.config.dbtConfigSource.dbtSecurityConfig.clientId') IS NOT NULL;

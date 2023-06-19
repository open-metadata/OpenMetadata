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

-- Rename chartUrl in chart_entity to sourceUrl
UPDATE chart_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.chartUrl'),
        '$.sourceUrl',
        JSON_EXTRACT(json, '$.chartUrl')
    )
WHERE JSON_EXTRACT(json, '$.chartUrl') IS NOT NULL;

-- Rename dashboardUrl in dashboard_entity to sourceUrl
UPDATE dashboard_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.dashboardUrl'),
        '$.sourceUrl',
        JSON_EXTRACT(json, '$.dashboardUrl')
    )
WHERE JSON_EXTRACT(json, '$.dashboardUrl') IS NOT NULL;

-- Rename pipelineUrl in pipeline_entity to sourceUrl
UPDATE pipeline_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.pipelineUrl'),
        '$.sourceUrl',
        JSON_EXTRACT(json, '$.pipelineUrl')
    )
WHERE JSON_EXTRACT(json, '$.pipelineUrl') IS NOT NULL;


-- Rename taskUrl in pipeline_entity to sourceUrl
UPDATE pipeline_entity AS pe
JOIN (
    SELECT id, JSON_ARRAYAGG(JSON_OBJECT(
        'name', t.name,
        'sourceUrl', t.sourceUrl,
        'taskType', t.taskType,
        'description', t.description,
        'displayName', t.displayName,
        'fullyQualifiedName', t.fullyQualifiedName,
        'downstreamTasks', t.downstreamTasks,
        'tags', t.tags,
        'endDate', t.endDate,
        'startDate', t.startDate,
        'taskSQL', t.taskSQL
    )) AS updated_json
    FROM pipeline_entity,
    JSON_TABLE(
        json,
        '$.tasks[*]' COLUMNS (
            name VARCHAR(256) PATH '$.name',
            sourceUrl VARCHAR(256) PATH '$.taskUrl',
            taskType VARCHAR(256) PATH '$.taskType',
            description TEXT PATH '$.description',
            displayName VARCHAR(256) PATH '$.displayName',
            fullyQualifiedName VARCHAR(256) PATH '$.fullyQualifiedName',
            downstreamTasks JSON PATH '$.downstreamTasks',
            tags JSON PATH '$.tags',
            endDate VARCHAR(256) PATH '$.endDate',
            startDate VARCHAR(256) PATH '$.startDate',
            taskSQL TEXT PATH '$.taskSQL'
        )
    ) AS t
    GROUP BY id
) AS updated_data
ON pe.id = updated_data.id
SET pe.json = JSON_INSERT(
    JSON_REMOVE(pe.json, '$.tasks'),
    '$.tasks',
    updated_data.updated_json
);

-- Modify migrations for service connection of postgres and mysql to move password under authType

UPDATE dbservice_entity
SET json = JSON_INSERT(
    JSON_REMOVE(json, '$.connection.config.password'),
    '$.connection.config.authType', 
    JSON_OBJECT(), 
    '$.connection.config.authType.password', 
    JSON_EXTRACT(json, '$.connection.config.password'))
where serviceType in ('Postgres', 'Mysql');


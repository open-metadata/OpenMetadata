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


-- add fullyQualifiedName hash and remove existing columns

-- update the OM system tables

ALTER TABLE  field_relationship DROP KEY `PRIMARY`, ADD COLUMN fromFQNHash VARCHAR(256), ADD COLUMN toFQNHash VARCHAR(256),
DROP INDEX from_index, DROP INDEX to_index, ADD INDEX from_fqnhash_index(fromFQNHash, relation), ADD INDEX to_fqnhash_index(toFQNHash, relation),
 ADD CONSTRAINT  `field_relationship_primary` PRIMARY KEY(fromFQNHash, toFQNHash, relation), MODIFY fromFQN VARCHAR(2096) NOT NULL,
 MODIFY toFQN VARCHAR(2096) NOT NULL;

ALTER TABLE entity_extension_time_series DROP COLUMN entityFQN, ADD COLUMN entityFQNHash VARCHAR (256) NOT NULL;

ALTER TABLE type_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

ALTER TABLE event_subscription_entity DROP KEY `name`,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

ALTER TABLE test_definition DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE test_suite DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE test_case DROP COLUMN fullyQualifiedName,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
     ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);

ALTER TABLE web_analytic_event DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);
ALTER TABLE data_insight_chart DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);
ALTER TABLE kpi_entity  DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

ALTER TABLE classification  DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);;

ALTER TABLE glossary_term_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;

ALTER TABLE tag DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;

ALTER TABLE tag_usage DROP index `source`, DROP COLUMN targetFQN, ADD COLUMN tagFQNHash VARCHAR(256), ADD COLUMN targetFQNHash VARCHAR(256),
     ADD UNIQUE KEY `tag_usage_key` (source, tagFQNHash, targetFQNHash);

ALTER TABLE policy_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;

ALTER TABLE role_entity DROP KEY `name`,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE automations_workflow DROP KEY `name`,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE test_connection_definition ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash),
    ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;


-- update services
ALTER TABLE dbservice_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE messaging_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE dashboard_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE pipeline_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE storage_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE metadata_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE mlmodel_service_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);


-- all entity tables
ALTER TABLE database_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE database_schema_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE table_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE metric_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE report_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE dashboard_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE chart_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE ml_model_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE topic_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE ingestion_pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE storage_container_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;
ALTER TABLE dashboard_data_model_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
 ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL;

ALTER TABLE query_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE team_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE user_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE bot_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE glossary_entity DROP KEY `name`, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

-- Remove sourceUrl in pipeline_entity from DatabricksPipeline & Fivetran
UPDATE pipeline_entity
SET json = JSON_REMOVE(json, '$.sourceUrl')
WHERE JSON_EXTRACT(json, '$.serviceType') in ('DatabricksPipeline','Fivetran');


-- Remove sourceUrl in dashboard_entity from Mode
UPDATE dashboard_entity 
SET json = JSON_REMOVE(json, '$.sourceUrl')
WHERE JSON_EXTRACT(json, '$.serviceType') in ('Mode');


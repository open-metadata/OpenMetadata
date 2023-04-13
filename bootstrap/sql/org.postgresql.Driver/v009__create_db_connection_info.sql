-- Unique constraint for user email address
ALTER TABLE user_entity
ADD UNIQUE (email);


-- Remove classificationName in BigQuery
UPDATE dbservice_entity SET json = json #- '{connection,config,classificationName}' where serviceType in ('BigQuery');

-- migrate ingestAllDatabases in postgres 
UPDATE dbservice_entity de2 
SET json = JSONB_SET(
    json || JSONB_SET(json,'{connection,config}', json#>'{connection,config}'|| 
    jsonb_build_object('database',
    (SELECT json->>'name' 
        FROM database_entity de 
        WHERE id = (SELECT er.toId 
                    FROM entity_relationship er 
                    WHERE er.fromId = de2.id 
                    AND er.toEntity = 'database' 
                    LIMIT 1)
    )
    )), 
    '{connection,config,ingestAllDatabases}', 
    'true'::jsonb
)
WHERE de2.serviceType = 'Postgres' 
AND json->>'{connection,config,database}' IS NULL;

-- new object store service and container entities
CREATE TABLE IF NOT EXISTS objectstore_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'serviceType') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (name)
);


CREATE TABLE IF NOT EXISTS objectstore_container_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS test_connection_definition (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS automations_workflow (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    workflowType VARCHAR(256) GENERATED ALWAYS AS (json ->> 'workflowType') STORED NOT NULL,
    status VARCHAR(256) GENERATED ALWAYS AS (json ->> 'status') STORED,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (name)
);

-- Do not store OM server connection, we'll set it dynamically on the resource
UPDATE ingestion_pipeline_entity
SET json = json::jsonb #- '{openMetadataServerConnection}';

CREATE TABLE IF NOT EXISTS query_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    nameHash VARCHAR(256) NOT NULl,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    UNIQUE (nameHash)
);

CREATE TABLE IF NOT EXISTS temp_query_migration (
    tableId VARCHAR(36) NOT NULL,
    queryId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    json JSONB NOT NULL
);

CREATE EXTENSION pgcrypto;

INSERT INTO temp_query_migration(tableId,json)
SELECT id,json_build_object('id',gen_random_uuid(),'vote',vote,'query',query,'users',users,'checksum',checksum,'duration',duration,'name','table','name',checksum,'updatedAt',
floor(EXTRACT(EPOCH FROM NOW())),'updatedBy','admin','deleted',false) AS json FROM entity_extension AS ee , jsonb_to_recordset(ee.json) AS x (vote decimal,query varchar,users json,
checksum varchar,duration decimal,queryDate varchar)
WHERE ee.extension = 'table.tableQueries';

INSERT INTO query_entity(json)
SELECT json FROM temp_query_migration;

INSERT INTO entity_relationship(fromId,toId,fromEntity,toEntity,relation)
SELECT tableId,queryId,'table','query',10 FROM temp_query_migration;

DELETE FROM entity_extension WHERE id in
(SELECT DISTINCT tableId FROM temp_query_migration) AND extension = 'table.tableQueries';

DROP TABLE temp_query_migration;

-- remove the audience if it was wrongfully sent from the UI after editing the OM service
UPDATE metadata_service_entity
SET json = json::jsonb #- '{connection,config,securityConfig,audience}'
WHERE name = 'OpenMetadata'
    AND json#>'{connection,config,authProvider}' IS NOT NULL
    AND json -> 'connection' -> 'config' ->> 'authProvider' != 'google';

ALTER TABLE user_tokens ALTER COLUMN expiryDate DROP NOT NULL;

DELETE FROM alert_entity;
drop table alert_action_def;

ALTER TABLE alert_entity RENAME TO event_subscription_entity;

-- create data model table
CREATE TABLE IF NOT EXISTS dashboard_data_model_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    fqnHash VARCHAR(256) NOT NULl,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (fqnHash)
);

UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb #- '{connection,config,database}', '{connection,config,databaseName}', json#> '{connection,config,database}', true)
WHERE servicetype = 'Druid' and json #>'{connection,config,database}' is not null;

-- We were using the same jsonSchema for Pipeline Services and Ingestion Pipeline status
-- Also, we relied on the extension to store the run id
UPDATE entity_extension_time_series
SET jsonSchema = 'ingestionPipelineStatus', extension = 'ingestionPipeline.pipelineStatus'
WHERE jsonSchema = 'pipelineStatus' AND extension <> 'pipeline.PipelineStatus';

DROP INDEX field_relationship_from_index, field_relationship_to_index;
ALTER TABLE field_relationship DROP CONSTRAINT field_relationship_pkey, ADD COLUMN fromFQNHash VARCHAR(256), ADD COLUMN toFQNHash VARCHAR(256),
    ADD CONSTRAINT  field_relationship_pkey PRIMARY KEY(fromFQNHash, toFQNHash, relation),
ALTER fromFQN TYPE VARCHAR(2096), ALTER toFQN TYPE VARCHAR(2096);
CREATE INDEX IF NOT EXISTS field_relationship_from_index ON field_relationship(fromFQNHash, relation);
CREATE INDEX IF NOT EXISTS field_relationship_to_index ON field_relationship(toFQNHash, relation);

ALTER TABLE entity_extension_time_series DROP COLUMN entityFQN, ADD COLUMN entityFQNHash VARCHAR (256) NOT NULL;

ALTER TABLE type_entity DROP CONSTRAINT type_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

ALTER TABLE event_subscription_entity DROP CONSTRAINT alert_entity_name_key,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

ALTER TABLE test_definition DROP CONSTRAINT test_definition_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE test_suite DROP CONSTRAINT test_suite_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE test_case DROP COLUMN fullyQualifiedName,  ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);

ALTER TABLE web_analytic_event DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);
ALTER TABLE data_insight_chart DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);
ALTER TABLE kpi_entity  DROP CONSTRAINT kpi_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

ALTER TABLE classification  DROP CONSTRAINT tag_category_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);;

ALTER TABLE glossary_term_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;

ALTER TABLE tag DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;

ALTER TABLE tag_usage DROP CONSTRAINT tag_usage_source_tagfqn_targetfqn_key, DROP COLUMN targetFQN, ADD COLUMN tagFQNHash VARCHAR(256), ADD COLUMN targetFQNHash VARCHAR(256),
    ADD UNIQUE (source, tagFQNHash, targetFQNHash);

ALTER TABLE policy_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;

ALTER TABLE role_entity DROP CONSTRAINT role_entity_name_key,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE automations_workflow DROP CONSTRAINT automations_workflow_name_key,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE test_connection_definition DROP CONSTRAINT test_connection_definition_name_key,  ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);


-- update services
ALTER TABLE dbservice_entity DROP CONSTRAINT dbservice_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE messaging_service_entity DROP CONSTRAINT messaging_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE dashboard_service_entity DROP CONSTRAINT dashboard_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE pipeline_service_entity DROP CONSTRAINT pipeline_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE storage_service_entity DROP CONSTRAINT storage_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE metadata_service_entity DROP CONSTRAINT metadata_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE mlmodel_service_entity DROP CONSTRAINT mlmodel_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE objectstore_service_entity DROP CONSTRAINT objectstore_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);



-- all entity tables
ALTER TABLE database_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE database_schema_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE table_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE metric_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE report_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE dashboard_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE chart_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE ml_model_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE topic_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') STORED NOT NULL;
ALTER TABLE location_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') STORED NOT NULL;
ALTER TABLE ingestion_pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') STORED NOT NULL;
ALTER TABLE objectstore_container_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') STORED NOT NULL;
ALTER TABLE team_entity DROP CONSTRAINT team_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE user_entity DROP CONSTRAINT user_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE bot_entity DROP CONSTRAINT bot_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE glossary_entity DROP CONSTRAINT glossary_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);


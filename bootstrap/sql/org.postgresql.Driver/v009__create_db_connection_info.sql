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

CREATE TABLE IF NOT EXISTS storage_container_entity (
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
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    PRIMARY KEY (id),
    UNIQUE (name)  
);

CREATE TABLE IF NOT EXISTS temp_query_migration (
    tableId VARCHAR(36) NOT NULL,
    queryId VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    queryName VARCHAR(255) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    json JSONB NOT NULL
);

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO temp_query_migration(tableId,json)
SELECT id,json_build_object('id',gen_random_uuid(),'vote',vote,'query',query,'users',users,'checksum',checksum,'duration',duration,'name',checksum,'updatedAt',
floor(EXTRACT(EPOCH FROM NOW())),'updatedBy','admin','deleted',false) AS json FROM entity_extension AS ee , jsonb_to_recordset(ee.json) AS x (vote decimal,query varchar,users json,
checksum varchar,name varchar, duration decimal,queryDate varchar)
WHERE ee.extension = 'table.tableQueries';

INSERT INTO query_entity (json)
SELECT value
FROM (
  SELECT jsonb_object_agg(queryName, json) AS json_data FROM ( SELECT DISTINCT queryName, json FROM temp_query_migration) subquery
) cte, jsonb_each(cte.json_data)
ON CONFLICT (name) DO UPDATE SET json = EXCLUDED.json;

INSERT INTO entity_relationship(fromId, toId, fromEntity, toEntity, relation)
SELECT tmq.tableId, qe.id, 'table', 'query', 5
FROM temp_query_migration tmq
JOIN query_entity qe ON qe.name = tmq.queryName;

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

ALTER TABLE alert_entity RENAME TO event_subscription_entity;
drop table if exists alert_action_def;
DELETE FROM event_subscription_entity;

-- create data model table
CREATE TABLE IF NOT EXISTS dashboard_data_model_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (fullyQualifiedName)
);

UPDATE dbservice_entity
SET json = jsonb_set(json::jsonb #- '{connection,config,database}', '{connection,config,databaseName}', json#> '{connection,config,database}', true)
WHERE servicetype = 'Druid' and json #>'{connection,config,database}' is not null;

-- We were using the same jsonSchema for Pipeline Services and Ingestion Pipeline status
-- Also, we relied on the extension to store the run id
UPDATE entity_extension_time_series
SET jsonSchema = 'ingestionPipelineStatus', extension = 'ingestionPipeline.pipelineStatus'
WHERE jsonSchema = 'pipelineStatus' AND extension <> 'pipeline.PipelineStatus';

-- We are refactoring the storage service with containers. We'll remove the locations
DROP TABLE location_entity;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,storageServiceName}'
WHERE servicetype = 'Glue';

UPDATE chart_entity
SET json = json::jsonb #- '{tables}';

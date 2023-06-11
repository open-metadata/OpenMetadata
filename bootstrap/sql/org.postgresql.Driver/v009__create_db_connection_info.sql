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
    nameHash VARCHAR(256) NOT NULl,
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
SELECT id,json_build_object('id',gen_random_uuid(),'query',query,'users',users,'checksum',checksum,'duration',duration,'name',checksum,'updatedAt',
floor(EXTRACT(EPOCH FROM NOW())),'updatedBy','admin','deleted',false) AS json FROM entity_extension AS ee , jsonb_to_recordset(ee.json) AS x (query varchar,users json,
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

CREATE TABLE IF NOT EXISTS event_subscription_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    json JSONB NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name)
);

drop table if exists alert_action_def;
drop table if exists alert_entity;
DELETE from entity_relationship where  fromEntity = 'alert' and toEntity = 'alertAction';

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
DROP TABLE location_entity;
DELETE FROM entity_relationship WHERE fromEntity='location' OR toEntity='location';
TRUNCATE TABLE storage_service_entity;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,storageServiceName}'
WHERE servicetype = 'Glue';

UPDATE chart_entity
SET json = json::jsonb #- '{tables}';

-- Updating the tableau authentication fields
UPDATE dashboard_service_entity
SET json = JSONB_SET(json::jsonb,
'{connection,config}',json::jsonb #>'{connection,config}' #- '{password}' #- '{username}'|| 
jsonb_build_object('authType',jsonb_build_object(
'username',json #>'{connection,config,username}',
'password',json #>'{connection,config,password}'
)), true)
where servicetype = 'Tableau'
and json#>'{connection,config,password}' is not null
and json#>'{connection,config,username}' is not null;

UPDATE dashboard_service_entity
SET json = JSONB_SET(json::jsonb,
'{connection,config}',json::jsonb #>'{connection,config}' #- '{personalAccessTokenName}' #- '{personalAccessTokenSecret}'|| 
jsonb_build_object('authType',jsonb_build_object(
'personalAccessTokenName',json #>'{connection,config,personalAccessTokenName}',
'personalAccessTokenSecret',json #>'{connection,config,personalAccessTokenSecret}'
)), true)
where servicetype = 'Tableau'
and json#>'{connection,config,personalAccessTokenName}' is not null
and json#>'{connection,config,personalAccessTokenSecret}' is not null;
    ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash);

-- Removed property from metadataService.json
UPDATE metadata_service_entity
SET json = json::jsonb #- '{allowServiceCreation}'
WHERE serviceType in ('Amundsen', 'Atlas', 'MetadataES', 'OpenMetadata');
ALTER TABLE kpi_entity  DROP CONSTRAINT kpi_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);

UPDATE metadata_service_entity
SET json = JSONB_SET(json::jsonb, '{provider}', '"system"')
WHERE name = 'OpenMetadata';

-- Fix Glue sample data endpoint URL to be a correct URI
UPDATE dbservice_entity
SET json = JSONB_SET(json::jsonb, '{connection,config,awsConfig,endPointURL}', '"https://glue.region_name.amazonaws.com/"')
WHERE serviceType = 'Glue'
  AND json#>'{connection,config,awsConfig,endPointURL}' = '"https://glue.<region_name>.amazonaws.com/"';

-- Delete connectionOptions from superset
UPDATE dashboard_service_entity
SET json = json::jsonb #- '{connection,config,connectionOptions}'
WHERE serviceType = 'Superset';

-- Delete partitionQueryDuration, partitionQuery, partitionField from bigquery
UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,partitionQueryDuration}' #- '{connection,config,partitionQuery}' #- '{connection,config,partitionField}'
WHERE serviceType = 'BigQuery';

-- Delete supportsQueryComment, scheme, hostPort, supportsProfiler from salesforce
UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,supportsQueryComment}' #- '{connection,config,scheme}' #- '{connection,config,hostPort}' #- '{connection,config,supportsProfiler}'
WHERE serviceType = 'Salesforce';

-- Delete supportsProfiler from DynamoDB
UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,supportsProfiler}'
WHERE serviceType = 'DynamoDB';

-- Update TagLabels source from 'Tag' to 'Classification' after #10486
UPDATE table_entity SET json = REGEXP_REPLACE(json::text, '"source"\s*:\s*"Tag\"', '"source": "Classification"', 'g')::jsonb;
UPDATE ml_model_entity SET json = REGEXP_REPLACE(json::text, '"source"\s*:\s*"Tag\"', '"source": "Classification"', 'g')::jsonb;

-- Delete uriString from Mssql
ALTER TABLE dbservice_entity DROP CONSTRAINT dbservice_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
UPDATE dbservice_entity
ALTER TABLE dashboard_service_entity DROP CONSTRAINT dashboard_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE pipeline_service_entity DROP CONSTRAINT pipeline_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE storage_service_entity DROP CONSTRAINT storage_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE metadata_service_entity DROP CONSTRAINT metadata_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE mlmodel_service_entity DROP CONSTRAINT mlmodel_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE objectstore_service_entity DROP CONSTRAINT objectstore_service_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);



-- all entity tables
ALTER TABLE database_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
SET json = json::jsonb #- '{connection,config,uriString}'
ALTER TABLE database_schema_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE table_entity DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE metric_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
WHERE serviceType = 'Mssql';ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE dashboard_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE chart_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE ml_model_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE pipeline_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE topic_entity  DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE location_entity  DROP COLUMN fullyQualifiedName,  ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE ingestion_pipeline_entity DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE objectstore_container_entity  DROP COLUMN fullyQualifiedName, ADD COLUMN fqnHash VARCHAR(256) NOT NULL, ADD UNIQUE (fqnHash),
ADD COLUMN name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL;
ALTER TABLE team_entity DROP CONSTRAINT team_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE user_entity DROP CONSTRAINT user_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE bot_entity DROP CONSTRAINT bot_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);
ALTER TABLE glossary_entity DROP CONSTRAINT glossary_entity_name_key, ADD COLUMN nameHash VARCHAR(256) NOT NULL, ADD UNIQUE (nameHash);


-- Unique constraint for user email address
ALTER TABLE user_entity
ADD UNIQUE (email);


-- Remove classificationName in BigQuery
UPDATE dbservice_entity
SET json = JSON_REMOVE(json, '$.connection.config.classificationName') where serviceType in ('BigQuery');

-- migrate ingestAllDatabases in postgres 
UPDATE dbservice_entity de2 
SET json = JSON_REPLACE(
    JSON_INSERT(json, 
      '$.connection.config.database', 
      (select JSON_EXTRACT(json, '$.name') 
        from database_entity de 
        where id = (select er.toId 
            from entity_relationship er 
            where er.fromId = de2.id 
              and er.toEntity = 'database' 
            LIMIT 1
          ))
    ), '$.connection.config.ingestAllDatabases', 
    true
  ) 
where de2.serviceType = 'Postgres' 
  and JSON_EXTRACT(json, '$.connection.config.database') is NULL;

-- new object store service and container entities
CREATE TABLE IF NOT EXISTS objectstore_service_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    serviceType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.serviceType') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS objectstore_container_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (fullyQualifiedName)
);

CREATE TABLE IF NOT EXISTS test_connection_definition (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS automations_workflow (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    workflowType VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.workflowType') STORED NOT NULL,
    status VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.status') STORED,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (name)
);

-- Do not store OM server connection, we'll set it dynamically on the resource
UPDATE ingestion_pipeline_entity
SET json = JSON_REMOVE(json, '$.openMetadataServerConnection');

CREATE TABLE IF NOT EXISTS query_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.name') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    UNIQUE(name),
    INDEX name_index (name)
);

CREATE TABLE IF NOT EXISTS temp_query_migration (
    tableId VARCHAR(36)NOT NULL,
    queryId VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') NOT NULL,
    json JSON NOT NULL
);


INSERT INTO temp_query_migration(tableId,json)
SELECT id,JSON_OBJECT('id',UUID(),'vote',vote,'query',query,'users',users,'checksum',checksum,'duration',duration,'name','table','name',checksum,
'updatedAt',UNIX_TIMESTAMP(NOW()),'updatedBy','admin','deleted',false) as json from entity_extension d, json_table(d.json, '$[*]' columns (vote double path '$.vote', query varchar(200) path '$.query',users json path '$.users',checksum varchar(200) path '$.checksum',duration double path '$.duration',
queryDate varchar(200) path '$.queryDate')) AS j WHERE extension = "table.tableQueries";

INSERT INTO query_entity(json)
SELECT json FROM temp_query_migration;

INSERT INTO entity_relationship(fromId,toId,fromEntity,toEntity,relation)
SELECT tableId,queryId,"table","query",5 FROM temp_query_migration;

DELETE FROM entity_extension WHERE id IN
 (SELECT DISTINCT tableId FROM temp_query_migration) AND extension = "table.tableQueries";

DROP Table temp_query_migration;

-- remove the audience if it was wrongfully sent from the UI after editing the OM service
UPDATE metadata_service_entity
SET json = JSON_REMOVE(json, '$.connection.config.securityConfig.audience')
WHERE name = 'OpenMetadata' AND JSON_EXTRACT(json, '$.connection.config.authProvider') != 'google';

ALTER TABLE user_tokens MODIFY COLUMN expiryDate BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.expiryDate');

DELETE FROM alert_entity;
drop table alert_action_def;

ALTER TABLE alert_entity RENAME TO event_subscription_entity;
-- create data model table
CREATE TABLE IF NOT EXISTS dashboard_data_model_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.fullyQualifiedName') NOT NULL,
    json JSON NOT NULL,
    updatedAt BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.updatedAt') NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> '$.updatedBy') NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS (json -> '$.deleted'),
    PRIMARY KEY (id),
    UNIQUE (fullyQualifiedName)
);

UPDATE dbservice_entity
SET json = JSON_INSERT(
        JSON_REMOVE(json, '$.connection.config.database'),
        '$.connection.config.databaseName', JSON_EXTRACT(json, '$.connection.config.database')
    )
where serviceType = 'Druid'
  and JSON_EXTRACT(json, '$.connection.config.database') is not null;

-- We were using the same jsonSchema for Pipeline Services and Ingestion Pipeline status
-- Also, we relied on the extension to store the run id
UPDATE entity_extension_time_series
SET jsonSchema = 'ingestionPipelineStatus', extension = 'ingestionPipeline.pipelineStatus'
WHERE jsonSchema = 'pipelineStatus' AND extension <> 'pipeline.PipelineStatus';

UPDATE chart_entity
SET json = JSON_REMOVE(json, '$.tables');

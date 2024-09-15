CREATE TABLE IF NOT EXISTS type_entity (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    category VARCHAR(256) GENERATED ALWAYS AS (json ->> 'category') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    PRIMARY KEY (id),
    UNIQUE (name)
);

ALTER TABLE webhook_entity
ADD status VARCHAR(256) GENERATED ALWAYS AS (json ->> 'status') STORED NOT NULL,
DROP COLUMN deleted;

DROP INDEX entity_relationship_edge_index;

CREATE TABLE IF NOT EXISTS mlmodel_service_entity (
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

UPDATE thread_entity
SET json = jsonb_set(json, '{type}', '"Conversation"', true);

update thread_entity
SET json = jsonb_set(json, '{reactions}', '[]'::jsonb, true);

ALTER TABLE thread_entity
    ADD type VARCHAR(64) GENERATED ALWAYS AS (json ->> 'type') STORED NOT NULL,
    ADD taskId INT GENERATED ALWAYS AS ((json#>'{task,id}')::integer) STORED,
    ADD taskStatus VARCHAR(64) GENERATED ALWAYS AS (json#>>'{task,status}') STORED,
    ADD taskAssignees JSONB GENERATED ALWAYS AS (json#>'{task,assignees}') STORED,
    ADD CONSTRAINT task_id_constraint UNIQUE(taskId);

CREATE INDEX IF NOT EXISTS thread_entity_type_index ON thread_entity(type);
CREATE INDEX IF NOT EXISTS thread_entity_task_assignees_index ON thread_entity(taskAssignees);
CREATE INDEX IF NOT EXISTS thread_entity_task_status_index ON thread_entity(taskStatus);
CREATE INDEX IF NOT EXISTS thread_entity_created_by_index ON thread_entity(createdBy);
CREATE INDEX IF NOT EXISTS thread_entity_updated_at_index ON thread_entity(updatedAt);

CREATE TABLE task_sequence (id SERIAL PRIMARY KEY, dummy varchar(1));
INSERT INTO task_sequence (dummy) VALUES (0) RETURNING id;

DELETE from ingestion_pipeline_entity where 1=1;
DELETE FROM pipeline_service_entity WHERE 1=1;

UPDATE dbservice_entity
SET json = jsonb_set(json, '{connection,config,databaseSchema}', json#>'{connection,config,database}')
where serviceType in ('Mysql','Hive','Presto','Trino','Clickhouse','SingleStore','MariaDB','Db2','Oracle')
  and json#>'{connection,config,database}' is not null;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,database}'
where serviceType in ('Mysql','Hive','Presto','Trino','Clickhouse','SingleStore','MariaDB','Db2','Oracle');

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,database}' #- '{connection,config,username}' #- '{connection,config,projectId}' #- '{connection,config,enablePolicyTagImport}'
WHERE serviceType = 'BigQuery';

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,database}'
WHERE serviceType in ('Athena','Databricks');

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,supportsProfiler}' #- '{connection,config,pipelineServiceName}'
WHERE serviceType = 'Glue';

UPDATE dashboard_service_entity
SET json = json::jsonb #- '{connection,config,dbServiceName}'
WHERE serviceType in ('Metabase','Superset','Tableau');

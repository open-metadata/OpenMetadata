UPDATE team_entity
SET json = JSONB_SET(json, '{teamType}', '"Group"', true);

ALTER TABLE team_entity
ADD teamType VARCHAR(64) GENERATED ALWAYS AS (json ->> 'teamType') STORED NOT NULL;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,database}'
where serviceType = 'DynamoDB';

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,connectionOptions}'
where serviceType = 'DeltaLake';

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,supportsProfiler}'
where serviceType = 'DeltaLake';

UPDATE dashboard_service_entity
SET json = jsonb_set(json, '{connection,config,clientId}', json#>'{connection,config,username}')
WHERE serviceType = 'Looker'
  and json#>'{connection,config,username}' is not null;

UPDATE dashboard_service_entity
SET json = jsonb_set(json, '{connection,config,clientSecret}', json#>'{connection,config,password}')
WHERE serviceType = 'Looker'
  and json#>'{connection,config,password}' is not null;

UPDATE dashboard_service_entity
SET json = json::jsonb #- '{connection,config,username}' #- '{connection,config,password}' #- '{connection,config,env}'
WHERE serviceType = 'Looker';

CREATE TABLE IF NOT EXISTS test_definition (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    json JSONB NOT NULL,
    entityType VARCHAR(36) GENERATED ALWAYS AS (json ->> 'entityType') STORED NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS test_suite (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    name VARCHAR(256) GENERATED ALWAYS AS (json ->> 'name') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS test_case (
    id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED NOT NULL,
    fullyQualifiedName VARCHAR(512) GENERATED ALWAYS AS (json ->> 'fullyQualifiedName') STORED NOT NULL,
    entityFQN VARCHAR (712) GENERATED ALWAYS AS (json ->> 'entityFQN') STORED NOT NULL,
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    UNIQUE (fullyQualifiedName)
);

UPDATE webhook_entity
SET json = JSONB_SET(json::jsonb, '{webhookType}', '"generic"', true);

ALTER TABLE webhook_entity
    ADD webhookType VARCHAR(36) GENERATED ALWAYS AS (json ->> 'webhookType') STORED NOT NULL;

CREATE TABLE IF NOT EXISTS entity_extension_time_series (
    entityFQN VARCHAR(1024) NOT NULL,           -- Entity FQN, we can refer to tables and columns
    extension VARCHAR(256) NOT NULL,            -- Extension name same as entity.fieldName
    jsonSchema VARCHAR(256) NOT NULL,           -- Schema used for generating JSON
    json JSONB NOT NULL,
    timestamp BIGINT GENERATED ALWAYS AS ((json ->> 'timestamp')::bigint) STORED NOT NULL
);


ALTER TABLE thread_entity
    ADD announcementStart BIGINT GENERATED ALWAYS AS ((json#>'{announcement,startTime}')::bigint) STORED,
    ADD announcementEnd BIGINT GENERATED ALWAYS AS ((json#>'{announcement,endTime}')::bigint) STORED;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,databaseSchema}' #- '{connection,config,oracleServiceName}'
WHERE serviceType = 'Oracle';

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,hostPort}'
WHERE serviceType = 'Athena';
UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,username}' #- '{connection,config,password}'
WHERE serviceType in ('Databricks');

CREATE TABLE IF NOT EXISTS openmetadata_settings (
    id SERIAL NOT NULL ,
    configType VARCHAR(36) NOT NULL,
    json JSONB NOT NULL,
    PRIMARY KEY (id, configType),
    UNIQUE(configType)
);

DELETE FROM entity_extension
WHERE jsonSchema IN ('tableProfile', 'columnTest', 'tableTest');

DELETE FROM ingestion_pipeline_entity 
WHERE json_extract_path_text("json", 'pipelineType') = 'profiler';

DELETE FROM role_entity;
DELETE FROM policy_entity;
DELETE FROM field_relationship WHERE fromType IN ('role', 'policy') OR toType IN ('role', 'policy');
DELETE FROM entity_relationship WHERE fromEntity IN ('role', 'policy') OR toEntity IN ('role', 'policy');
ALTER TABLE role_entity DROP COLUMN defaultRole;

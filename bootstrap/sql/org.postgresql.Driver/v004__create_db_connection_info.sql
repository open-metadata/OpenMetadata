UPDATE team_entity
SET json = JSONB_SET(json, '{teamType}', '"Department"', true);

ALTER TABLE team_entity
ADD teamType VARCHAR(64) GENERATED ALWAYS AS (json ->> 'teamType') STORED NOT NULL;

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,database}'
where serviceType = 'DynamoDB';

UPDATE dbservice_entity
SET json = json::jsonb #- '{connection,config,connectionOptions}'
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
    json JSONB NOT NULL,
    updatedAt BIGINT GENERATED ALWAYS AS ((json ->> 'updatedAt')::bigint) STORED NOT NULL,
    updatedBy VARCHAR(256) GENERATED ALWAYS AS (json ->> 'updatedBy') STORED NOT NULL,
    deleted BOOLEAN GENERATED ALWAYS AS ((json ->> 'deleted')::boolean) STORED,
    UNIQUE (fullyQualifiedName)
);

UPDATE webhook_entity
SET json = JSONB_SET(json::jsonb, '{webhookType}', '"generic"', true);
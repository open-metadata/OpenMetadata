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

ALTER TABLE user_tokens MODIFY COLUMN expiryDate BIGINT UNSIGNED GENERATED ALWAYS AS (json ->> '$.expiryDate');
